// Augments the globally declared ioBroker types with everything this adapter adds.
// Keep in sync with `native` in io-package.json and with admin/jsonConfig.json.
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            /** Port of the own HTTP server (standalone mode only) */
            port: number;
            /** Web instance ("web.0" or "*" for all) to run in as a web extension, "" for standalone */
            webInstance: string;
            /** Path below the web adapter in extension mode, e.g. "webhook" */
            route: string;
        }
    }
}

export {};
