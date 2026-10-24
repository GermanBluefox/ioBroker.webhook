import type { ServerResponse } from 'node:http';

import type { JsonObject, JsonPrimitive, JsonValue, WebhookRequest } from './types';

/** Maximum size of a JSON body: the default of body-parser, which was used before */
const BODY_LIMIT = 100 * 1024;

/** Keys that must never be used to build objects from the query string */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

class HttpError extends Error {
    public constructor(
        public readonly status: number,
        message: string,
    ) {
        super(message);
    }
}

/** Determines the `common.type` of a received value */
function determineType(value: JsonPrimitive): string {
    if (value === null) {
        return 'null';
    }
    // String representing a number. Note: the value itself is stored unconverted
    if (typeof value === 'string' && !isNaN(value.trim() as unknown as number)) {
        return 'number';
    }
    return typeof value;
}

/**
 * Parses a query string into the same state tree the "extended" (qs) parser of express produced:
 * `a[b]=1` gives `a.b`, `a[]=1&a[]=2` and `a=1&a=2` give `a.0` and `a.1`.
 * Lists are built as objects with index keys, which results in the same state IDs as arrays.
 */
export function parseQuery(search: string): JsonObject {
    const result: JsonObject = {};

    for (const [key, value] of new URLSearchParams(search)) {
        const match = /^([^[\]]+)((?:\[[^[\]]*\])*)$/.exec(key);
        const path = match ? [match[1], ...Array.from(match[2].matchAll(/\[([^[\]]*)\]/g), m => m[1])] : [key];
        if (path.some(part => UNSAFE_KEYS.has(part))) {
            continue;
        }

        let target = result;
        for (const [i, segment] of path.entries()) {
            // `a[]` appends
            const part = segment || String(Object.keys(target).length);
            const existing = target[part];

            if (i === path.length - 1) {
                if (existing === undefined) {
                    target[part] = value;
                } else if (typeof existing === 'object' && existing !== null) {
                    (existing as JsonObject)[Object.keys(existing).length] = value;
                } else {
                    // a repeated key becomes a list
                    target[part] = { 0: existing, 1: value };
                }
            } else if (typeof existing === 'object' && existing !== null) {
                target = existing as JsonObject;
            } else {
                const next: JsonObject = {};
                target[part] = next;
                target = next;
            }
        }
    }

    return result;
}

/** Reads the body of a request, or takes it from the body parsers of web that already read it */
async function readBody(req: WebhookRequest): Promise<Buffer | JsonValue> {
    if (req.rawBody) {
        return req.rawBody;
    }
    if (req.readableEnded) {
        // Consumed by a parser that kept nothing but the result
        return typeof req.body === 'object' ? (req.body as JsonValue) : {};
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
        size += chunk.length;
        if (size > BODY_LIMIT) {
            throw new HttpError(413, 'Request entity too large');
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

/** Like `bodyParser.json()`: only `application/json`, only objects and arrays, everything else gives `{}` */
async function parseBody(req: WebhookRequest): Promise<JsonObject | JsonValue[]> {
    if (!/^application\/json\s*(;|$)/i.test(req.headers['content-type'] ?? '')) {
        return {};
    }
    const body = await readBody(req);
    if (!Buffer.isBuffer(body)) {
        return typeof body === 'object' && body !== null ? body : {};
    }

    const text = body.toString('utf8').trim();
    if (!text) {
        return {};
    }
    if (text[0] !== '{' && text[0] !== '[') {
        throw new HttpError(400, 'JSON body must be an object or an array');
    }
    try {
        return JSON.parse(text) as JsonObject | JsonValue[];
    } catch (e) {
        throw new HttpError(400, `Invalid JSON: ${(e as Error).message}`);
    }
}

function sendJson(res: ServerResponse, status: number, data: JsonObject): void {
    const body = JSON.stringify(data);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.end(body);
}

/**
 * Turns every request into states below `<namespace>.<url path>`.
 *
 * `adapter` is this adapter in standalone mode, but the web adapter in extension mode. Therefore,
 * all IDs are written as foreign IDs with the namespace of this instance.
 */
export class Webhook {
    public constructor(
        private readonly adapter: ioBroker.Adapter,
        private readonly namespace: string,
    ) {}

    /** Handles one request. `req.url` is relative to the mount point of the webhook */
    public async handle(req: WebhookRequest, res: ServerResponse): Promise<void> {
        // CORS like `cors()` with default options
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
            const requestHeaders = req.headers['access-control-request-headers'];
            if (requestHeaders) {
                res.setHeader('Access-Control-Allow-Headers', requestHeaders);
                res.setHeader('Vary', 'Access-Control-Request-Headers');
            }
            res.statusCode = 204;
            res.setHeader('Content-Length', '0');
            res.end();
            return;
        }

        try {
            const url = req.url ?? '/';
            const queryStart = url.indexOf('?');
            const pathname = queryStart === -1 ? url : url.substring(0, queryStart);
            const search = queryStart === -1 ? '' : url.substring(queryStart + 1);

            const basePath =
                pathname
                    .split('/')
                    .filter(part => part.trim() !== '')
                    // Intentional legacy: a request to "/" was stored below "undefined"
                    .join('.') || String(undefined);

            const meta: JsonObject = {
                ip: req.ip ?? req.socket.remoteAddress ?? null,
                method: req.method ?? 'GET',
                timestamp: new Date().toISOString(),
            };

            // Body for POST, query parameters for everything else
            const data = req.method === 'POST' ? await parseBody(req) : parseQuery(search);

            await this.store(meta, `${basePath}.meta`);
            await this.store(data, `${basePath}.data`);

            sendJson(res, 200, { status: 'success' });
        } catch (e) {
            const status = e instanceof HttpError ? e.status : 500;
            if (status === 500) {
                this.adapter.log.error(`${this.namespace}: Cannot process webhook ${req.url}: ${(e as Error).message}`);
            }
            sendJson(res, status, { status: 'error', error: (e as Error).message });
        }
    }

    /** Recursively creates one state per primitive value */
    private async store(data: JsonObject | JsonValue[], parentPath: string): Promise<void> {
        for (const [key, value] of Object.entries(data)) {
            const id = `${parentPath}.${key}`;

            if (typeof value === 'object' && value !== null) {
                await this.store(value, id);
            } else {
                const fullId = `${this.namespace}.${id}`;
                await this.adapter.setForeignObjectNotExistsAsync(fullId, {
                    type: 'state',
                    common: {
                        name: key,
                        role: 'state',
                        type: determineType(value) as ioBroker.CommonType,
                        read: true,
                        write: true,
                    },
                    native: {},
                });
                await this.adapter.setForeignStateAsync(fullId, { val: value, ack: true });
            }
        }
    }
}
