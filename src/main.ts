import { createServer, type Server } from 'node:http';

import * as utils from '@iobroker/adapter-core';

import { Webhook } from './lib/webhook';

/** Default port of the standalone server */
const DEFAULT_PORT = 8095;

// Exclusive-resource registry of js-controller 8 (the part used here). The installed types and
// older controllers do not have it, so it is probed at runtime.
type TcpPortResource = { port: number; bind?: string };
interface ResourceRegistry {
    registerUsedResource(type: 'tcpPort', data: TcpPortResource): Promise<void>;
    checkUsedResource?(type: 'tcpPort', data?: Partial<TcpPortResource>): Promise<{ instance: string }[]>;
}

class WebhookAdapter extends utils.Adapter {
    private server: Server | null = null;
    private terminateTimer: ioBroker.Timeout | undefined;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'webhook' });

        this.on('ready', () => this.onReady());
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
        this.server.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
                void this.findPortHolders(port).then(holders =>
                    this.log.error(
                        `Cannot start the server: port ${port} is already used${holders ? ` by ${holders}` : ''}`,
                    ),
                );
            } else {
                this.log.error(`Error starting the server: ${error.message}`);
            }
        });
        this.server.listen(port, () => {
            this.log.info(`Webhook server running on port ${port}`);
            void this.registerUsedPort(port);
        });
    }

    /** The exclusive-resource API of js-controller 8, or null if the controller does not have it */
    private resourceRegistry(): ResourceRegistry | null {
        return typeof this.registerUsedResource === 'function' ? this : null;
    }

    /** Asks js-controller (>= 8), which instances registered the port, e.g. "web.0" */
    private async findPortHolders(port: number): Promise<string> {
        try {
            const holders = (await this.resourceRegistry()?.checkUsedResource?.('tcpPort', { port })) ?? [];
            return holders.map(h => h.instance).join(', ');
        } catch (e) {
            this.log.debug(`Cannot check which instance uses port ${port}: ${(e as Error).message}`);
            return '';
        }
    }

    /** Reports the port of the server to js-controller (>= 8), so it shows up as occupied */
    private async registerUsedPort(port: number): Promise<void> {
        const registry = this.resourceRegistry();
        if (!registry) {
            return;
        }
        try {
            await registry.registerUsedResource('tcpPort', { port });
        } catch (e) {
            this.log.warn(`Cannot register port ${port} as used: ${(e as Error).message}`);
        }
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
