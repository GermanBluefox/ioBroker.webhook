import type { Server } from 'node:http';

import * as utils from '@iobroker/adapter-core';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Determines the `common.type` of a received value */
function determineType(value: JsonValue): string {
    if (Array.isArray(value)) {
        return 'array';
    }
    if (value === null) {
        return 'null';
    }
    // String representing a number. Note: the value itself is stored unconverted
    if (typeof value === 'string' && !isNaN(value.trim() as unknown as number)) {
        return 'number';
    }
    return typeof value;
}

class WebhookAdapter extends utils.Adapter {
    private server: Server | null = null;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'webhook' });

        this.on('ready', () => this.onReady());
        this.on('stateChange', (id, state) => this.onStateChange(id, state));
        this.on('unload', callback => this.onUnload(callback));
    }

    private onReady(): void {
        this.log.info('Adapter is ready!');

        const port = this.config.port || 8095;
        this.log.info(`Starting webhook server on port ${port}`);

        const app = express();
        app.use(cors());
        app.use(bodyParser.json());

        // Handle all incoming requests
        app.all('*', async (req, res) => {
            const urlParts = req.path.split('/').filter(part => part.trim() !== '');
            // Intentional legacy: "folder + last part" is simply the whole path joined with dots
            const folderPath = urlParts.slice(0, -1).join('.');
            const lastPart = urlParts[urlParts.length - 1];
            const basePath = folderPath ? `${folderPath}.${lastPart}` : lastPart;

            const meta: Record<string, JsonValue> = {
                ip: req.ip ?? null,
                method: req.method,
                timestamp: new Date().toISOString(),
            };

            // Body for POST, query parameters for everything else
            const data = (req.method === 'POST' ? req.body : req.query) as Record<string, JsonValue>;

            await this.processJson(meta, `${basePath}.meta`);
            await this.processJson(data, `${basePath}.data`);

            res.setHeader('Content-Type', 'application/json');
            res.status(200).json({ status: 'success' });
        });

        try {
            this.server = app.listen(port, () => this.log.info(`Webhook server running on port ${port}`));
        } catch (error) {
            this.log.error(`Error starting the server: ${(error as Error).message}`);
        }
    }

    /** Recursively creates one state per primitive value */
    private async processJson(data: Record<string, JsonValue> | JsonValue[], parentPath: string): Promise<void> {
        for (const [key, value] of Object.entries(data)) {
            const currentPath = `${parentPath}.${key}`;

            if (typeof value === 'object' && value !== null) {
                await this.processJson(value, currentPath);
            } else {
                await this.setObjectNotExistsAsync(currentPath, {
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
                await this.setStateAsync(currentPath, { val: value, ack: true });
            }
        }
    }

    private onStateChange(id: string, _state: ioBroker.State | null | undefined): void {
        this.log.debug(`State change detected: ${id}`);
    }

    private onUnload(callback: () => void): void {
        try {
            if (this.server) {
                this.server.close();
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
