import type { Server } from 'node:http';

import type { WebApp } from './types';
import { Webhook } from './webhook';

/** Default route below the web adapter: http://<host>:8082/webhook/<path> */
export const DEFAULT_ROUTE = 'webhook';

/** Trims slashes, so that "/webhook/", "webhook" and "" (default) all work */
export function normalizeRoute(route: string | undefined): string {
    return (route ?? '').replace(/^\/+|\/+$/g, '') || DEFAULT_ROUTE;
}

/**
 * Web extension: loaded by the web adapter (see `common.webExtension` in io-package.json) when
 * `native.webInstance` of this instance points to that web instance.
 */
export default class WebhookWebExtension {
    /** The route stays registered in express until web restarts, so it is only switched off */
    private active = true;

    /**
     * @param _server http(s) server of the web adapter
     * @param _webSettings settings of the web adapter
     * @param adapter the web adapter, not this one
     * @param instanceSettings instance object of this webhook instance
     * @param app express app of the web adapter
     */
    public constructor(
        _server: Server,
        _webSettings: Record<string, unknown>,
        adapter: ioBroker.Adapter,
        instanceSettings: ioBroker.InstanceObject,
        app: WebApp,
    ) {
        // "webhook.0" - the namespace of THIS instance, not the one of web
        const namespace = instanceSettings._id.substring('system.adapter.'.length);
        const route = normalizeRoute((instanceSettings.native as ioBroker.AdapterConfig).route);
        const webhook = new Webhook(adapter, namespace);

        adapter.log.info(`${namespace}: install webhook on /${route}/`);
        app.use(`/${route}`, (req, res, next) => {
            if (this.active) {
                void webhook.handle(req, res);
            } else {
                next();
            }
        });
    }

    public unload(): Promise<void> {
        this.active = false;
        return Promise.resolve();
    }
}
