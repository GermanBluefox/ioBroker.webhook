import type { IncomingMessage, ServerResponse } from 'node:http';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export interface JsonObject {
    [key: string]: JsonValue;
}

/**
 * A request as delivered by node:http (standalone mode) or by the express app of the web adapter
 * (extension mode), where body parsers may already have consumed the stream.
 */
export interface WebhookRequest extends IncomingMessage {
    /** Set by express: the client address, respecting the "trust proxy" setting of web */
    ip?: string;
    /** Set by the body parsers of web (only active when web has authentication enabled) */
    body?: unknown;
    /** Kept by the body parsers of web */
    rawBody?: Buffer;
}

/** The part of the express app of web that the extension uses */
export interface WebApp {
    use(path: string, handler: (req: WebhookRequest, res: ServerResponse, next: () => void) => void): unknown;
}
