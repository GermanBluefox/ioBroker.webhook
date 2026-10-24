"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ROUTE = void 0;
exports.normalizeRoute = normalizeRoute;
const webhook_1 = require("./webhook");
/** Default route below the web adapter: http://<host>:8082/webhook/<path> */
exports.DEFAULT_ROUTE = 'webhook';
/** Trims slashes, so that "/webhook/", "webhook" and "" (default) all work */
function normalizeRoute(route) {
    return (route ?? '').replace(/^\/+|\/+$/g, '') || exports.DEFAULT_ROUTE;
}
/**
 * Web extension: loaded by the web adapter (see `common.webExtension` in io-package.json) when
 * `native.webInstance` of this instance points to that web instance.
 */
class WebhookWebExtension {
    /** The route stays registered in express until web restarts, so it is only switched off */
    active = true;
    /**
     * @param _server http(s) server of the web adapter
     * @param _webSettings settings of the web adapter
     * @param adapter the web adapter, not this one
     * @param instanceSettings instance object of this webhook instance
     * @param app express app of the web adapter
     */
    constructor(_server, _webSettings, adapter, instanceSettings, app) {
        // "webhook.0" - the namespace of THIS instance, not the one of web
        const namespace = instanceSettings._id.substring('system.adapter.'.length);
        const route = normalizeRoute(instanceSettings.native.route);
        const webhook = new webhook_1.Webhook(adapter, namespace);
        adapter.log.info(`${namespace}: install webhook on /${route}/`);
        app.use(`/${route}`, (req, res, next) => {
            if (this.active) {
                void webhook.handle(req, res);
            }
            else {
                next();
            }
        });
    }
    unload() {
        this.active = false;
        return Promise.resolve();
    }
}
exports.default = WebhookWebExtension;
//# sourceMappingURL=web.js.map