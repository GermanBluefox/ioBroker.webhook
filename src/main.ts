import { createServer, type Server } from 'node:http';

import * as utils from '@iobroker/adapter-core';

import { Webhook } from './lib/webhook';

/** Default port of the standalone server */
const DEFAULT_PORT = 8095;

class WebhookAdapter extends utils.Adapter {
    private server: Server | null = null;
    private terminateTimer: ioBroker.Timeout | undefined;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'webhook' });

        this.on('ready', () => this.onReady());
        this.on('stateChange', (id, state) => this.onStateChange(id, state));
        this.on('unload', callback => this.onUnload(callback));
    }

    private async onReady(): Promise<void> {
        await this.setState('info.extension', !!this.config.webInstance, true);

        if (this.config.webInstance) {
            // The web adapter loads build/lib/web.js; this process has nothing to do
            this.log.info(`Adapter runs as a part of web service "${this.config.webInstance}"`);
            await this.setForeignStateAsync(`system.adapter.${this.namespace}.alive`, false, true);
            this.terminateTimer = this.setTimeout(
                () => this.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION),
                1000,
            );
            return;
        }

        const port = this.config.port || DEFAULT_PORT;
        this.log.info(`Starting webhook server on port ${port}`);

        const webhook = new Webhook(this, this.namespace);
        this.server = createServer((req, res) => void webhook.handle(req, res));
        // e.g. EADDRINUSE: arrives as event, not as exception of listen()
        this.server.on('error', error => this.log.error(`Error starting the server: ${error.message}`));
        this.server.listen(port, () => this.log.info(`Webhook server running on port ${port}`));
    }

    private onStateChange(id: string, _state: ioBroker.State | null | undefined): void {
        this.log.debug(`State change detected: ${id}`);
    }

    private onUnload(callback: () => void): void {
        try {
            this.clearTimeout(this.terminateTimer);
            if (this.server) {
                this.server.close();
                // keep-alive connections would delay the end of the process
                this.server.closeAllConnections();
                this.server = null;
                this.log.info('Webhook server stopped.');
            }
        } catch (e) {
            this.log.error(`Error while stopping the server: ${(e as Error).message}`);
        }
        callback();
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new WebhookAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new WebhookAdapter())();
}
