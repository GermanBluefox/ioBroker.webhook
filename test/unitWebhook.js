'use strict';

// Tests the request handling of build/lib/webhook.js (run `npm run build` first)
const assert = require('node:assert');
const { createServer } = require('node:http');

const { Webhook, parseQuery } = require('../build/lib/webhook');

function createFakeAdapter() {
    const objects = {};
    const states = {};
    return {
        objects,
        states,
        log: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
        setForeignObjectNotExistsAsync: async (id, obj) => {
            objects[id] ??= obj;
        },
        setForeignStateAsync: async (id, state) => {
            states[id] = state;
        },
    };
}

describe('parseQuery', () => {
    it('should build nested objects and lists like qs', () => {
        assert.deepStrictEqual(parseQuery('a=1&b[c]=2&d[]=3&d[]=4&e=5&e=6'), {
            a: '1',
            b: { c: '2' },
            d: { 0: '3', 1: '4' },
            e: { 0: '5', 1: '6' },
        });
    });

    it('should ignore prototype keys', () => {
        assert.deepStrictEqual(parseQuery('__proto__[x]=1&a[constructor]=2'), {});
        assert.strictEqual({}.x, undefined);
    });
});

describe('Webhook', () => {
    let adapter;
    let server;
    let baseUrl;

    beforeEach(async () => {
        adapter = createFakeAdapter();
        const webhook = new Webhook(adapter, 'webhook.0');
        server = createServer((req, res) => void webhook.handle(req, res));
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterEach(() => new Promise(resolve => server.close(resolve)));

    it('should store a JSON body of POST below the path', async () => {
        const res = await fetch(`${baseUrl}/wohnzimmer/fenster`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ temperature: 22.5, sensor: { open: true } }),
        });
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { status: 'success' });
        assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');

        assert.strictEqual(adapter.states['webhook.0.wohnzimmer.fenster.data.temperature'].val, 22.5);
        assert.strictEqual(adapter.states['webhook.0.wohnzimmer.fenster.data.sensor.open'].val, true);
        assert.strictEqual(adapter.states['webhook.0.wohnzimmer.fenster.meta.method'].val, 'POST');
        assert.ok(adapter.states['webhook.0.wohnzimmer.fenster.meta.ip'].val);
        assert.ok(adapter.states['webhook.0.wohnzimmer.fenster.meta.timestamp'].val);
        assert.strictEqual(adapter.objects['webhook.0.wohnzimmer.fenster.data.temperature'].common.type, 'number');
        assert.strictEqual(adapter.states['webhook.0.wohnzimmer.fenster.data.temperature'].ack, true);
    });

    it('should store query parameters of GET', async () => {
        const res = await fetch(`${baseUrl}/garten?level=3&name=pump`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(adapter.states['webhook.0.garten.data.level'].val, '3');
        assert.strictEqual(adapter.states['webhook.0.garten.data.name'].val, 'pump');
        assert.strictEqual(adapter.states['webhook.0.garten.meta.method'].val, 'GET');
    });

    it('should ignore bodies that are not JSON', async () => {
        const res = await fetch(`${baseUrl}/form`, { method: 'POST', body: 'a=1' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(adapter.states['webhook.0.form.data.a'], undefined);
        assert.strictEqual(adapter.states['webhook.0.form.meta.method'].val, 'POST');
    });

    it('should reject invalid JSON with 400', async () => {
        const res = await fetch(`${baseUrl}/x`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{"a":',
        });
        assert.strictEqual(res.status, 400);
        assert.strictEqual((await res.json()).status, 'error');
    });

    it('should reject bodies larger than 100 KB with 413', async () => {
        const res = await fetch(`${baseUrl}/x`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ a: 'x'.repeat(110 * 1024) }),
        });
        assert.strictEqual(res.status, 413);
    });

    it('should answer CORS preflight requests without storing anything', async () => {
        const res = await fetch(`${baseUrl}/x`, {
            method: 'OPTIONS',
            headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
        });
        assert.strictEqual(res.status, 204);
        assert.strictEqual(res.headers.get('access-control-allow-headers'), 'content-type');
        assert.deepStrictEqual(adapter.states, {});
    });

    it('should use a body already read by the parsers of web', async () => {
        const webhook = new Webhook(adapter, 'webhook.0');
        const req = {
            url: '/ext?ignored=1',
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            socket: { remoteAddress: '10.0.0.1' },
            ip: '10.0.0.2',
            rawBody: Buffer.from('{"value":1}'),
        };
        let status = 0;
        const res = { statusCode: 0, setHeader: () => {}, end: () => (status = res.statusCode) };
        await webhook.handle(req, res);
        assert.strictEqual(status, 200);
        assert.strictEqual(adapter.states['webhook.0.ext.data.value'].val, 1);
        assert.strictEqual(adapter.states['webhook.0.ext.meta.ip'].val, '10.0.0.2');
    });
});
