"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const utils = __importStar(require("@iobroker/adapter-core"));
const webhook_1 = require("./lib/webhook");
/** Default port of the standalone server */
const DEFAULT_PORT = 8095;
class WebhookAdapter extends utils.Adapter {
    server = null;
    terminateTimer;
    constructor(options = {}) {
        super({ ...options, name: 'webhook' });
        this.on('ready', () => this.onReady());
        this.on('unload', callback => this.onUnload(callback));
    }
    async onReady() {
        await this.setState('info.extension', !!this.config.webInstance, true);
        if (this.config.webInstance) {
            // The web adapter loads build/lib/web.js; this process has nothing to do
            this.log.info(`Adapter runs as a part of web service "${this.config.webInstance}"`);
            await this.setForeignStateAsync(`system.adapter.${this.namespace}.alive`, false, true);
            this.terminateTimer = this.setTimeout(() => this.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION), 1000);
            return;
        }
        const port = this.config.port || DEFAULT_PORT;
        this.log.info(`Starting webhook server on port ${port}`);
        const webhook = new webhook_1.Webhook(this, this.namespace);
        this.server = (0, node_http_1.createServer)((req, res) => void webhook.handle(req, res));
        // e.g. EADDRINUSE: arrives as event, not as exception of listen()
        this.server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                void this.findPortHolders(port).then(holders => this.log.error(`Cannot start the server: port ${port} is already used${holders ? ` by ${holders}` : ''}`));
            }
            else {
                this.log.error(`Error starting the server: ${error.message}`);
            }
        });
        this.server.listen(port, () => {
            this.log.info(`Webhook server running on port ${port}`);
            void this.registerUsedPort(port);
        });
    }
    /** The exclusive-resource API of js-controller 8, or null if the controller does not have it */
    resourceRegistry() {
        return typeof this.registerUsedResource === 'function' ? this : null;
    }
    /** Asks js-controller (>= 8), which instances registered the port, e.g. "web.0" */
    async findPortHolders(port) {
        try {
            const holders = (await this.resourceRegistry()?.checkUsedResource?.('tcpPort', { port })) ?? [];
            return holders.map(h => h.instance).join(', ');
        }
        catch (e) {
            this.log.debug(`Cannot check which instance uses port ${port}: ${e.message}`);
            return '';
        }
    }
    /** Reports the port of the server to js-controller (>= 8), so it shows up as occupied */
    async registerUsedPort(port) {
        const registry = this.resourceRegistry();
        if (!registry) {
            return;
        }
        try {
            await registry.registerUsedResource('tcpPort', { port });
        }
        catch (e) {
            this.log.warn(`Cannot register port ${port} as used: ${e.message}`);
        }
    }
    onUnload(callback) {
        try {
            this.clearTimeout(this.terminateTimer);
            if (this.server) {
                this.server.close();
                // keep-alive connections would delay the end of the process
                this.server.closeAllConnections();
                this.server = null;
                this.log.info('Webhook server stopped.');
            }
        }
        catch (e) {
            this.log.error(`Error while stopping the server: ${e.message}`);
        }
        callback();
    }
}
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new WebhookAdapter(options);
}
else {
    // otherwise start the instance directly
    (() => new WebhookAdapter())();
}
//# sourceMappingURL=main.js.map