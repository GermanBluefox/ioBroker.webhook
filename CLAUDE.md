# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ioBroker adapter `webhook` (npm `iobroker.webhook`, TypeScript in `src/`, compiled to `build/`) that turns every incoming HTTP request into states. It either runs its own `node:http` server (standalone) or, when `native.webInstance` is set, runs inside the `web` adapter as a web extension. No runtime dependencies besides `@iobroker/adapter-core`. Node >= 22.19, js-controller >= 6.0.11, admin >= 7.7.22. README.md is English (with changelog and license); the German documentation is `docs/de/README.md` - keep both in sync.

The adapter was renamed from `iobroker-webhook` (the io-package schema forbids names starting with "iobroker"); the repository is `GermanBluefox/ioBroker.webhook`, a fork of `MrErdnuss/ioBroker.iobroker-webhook`.

## Commands

```bash
npm run build             # tsc -p tsconfig.build.json -> build/ (gitignored, common.nogit: true)
npm run check             # type-check only
npm run lint              # @iobroker/eslint-config incl. prettier; fix with: npx eslint -c eslint.config.mjs --fix src
npm test                  # test:package + test:unit
npm run test:unit         # mocha test/unitWebhook test/unitRoles - tests run against build/, so build first
npm run test:integration  # starts a real js-controller in %TEMP% and POSTs a webhook to port 18095
npm run translate         # translate-adapter -b admin/i18n/en.json
npm run release-minor     # @alcalzone/release-script (README changelog, io-package news, LICENSE year)
```

Single test: `npx mocha test/unitRoles --exit -g "German"`. Tests use `node:assert`, no chai. There is no `prepare` script on purpose: `npm ci` does not build, CI builds via `build: true` in the ioBroker GitHub actions.

## Architecture

- `src/lib/webhook.ts` - `Webhook.handle(req, res)` is the whole request logic and works on plain `node:http` objects, so the same code serves both modes. `req.url` is relative to the mount point: path segments -> ID prefix (URI-decoded, forbidden chars -> `_`, `/` -> directly below the namespace), then `<prefix>.meta.{ip,method,timestamp}` and `<prefix>.data.*`. Data is the JSON body for POST/PUT/PATCH (only `application/json`, 100 KB limit, objects/arrays only, otherwise 400/413) and the query string otherwise (`parseQuery` mimics express' qs parser; lists become index keys, which yields the same IDs as arrays). CORS headers and OPTIONS preflight replace the former `cors()`.
- **Foreign IDs everywhere:** in extension mode the `adapter` passed to `Webhook` is the *web* adapter, so all writes are `setForeignObjectNotExistsAsync` / `setForeignStateAsync` with `<this namespace>.<id>`. Don't switch to the non-foreign methods.
- Objects are created with `setObjectNotExists`, so `common.type`/`role`/`unit`/`min`/`max` are fixed on first creation. Lossless numeric strings (`String(Number(s)) === s`) are stored as numbers; `null` gets type `mixed` (js-controller rejects `null` as type).
- `src/lib/roles.ts` - `detectCommon(name, value, parentName)` returns `role` and, for numbers, `unit`/`min`/`max`: ordered rule list (first rule with a role for the value type wins, so specific rules come before generic ones, e.g. `battery_voltage` before `battery`, `current` after `power`). Names are normalized to `_`-joined lowercase tokens (camelCase, digits and Unicode split, so `CO2Level` -> `co_2_level`); patterns are normalized the same way and match whole tokens. Falls back to the parent key (or the last URL segment for top-level data), then `value`/`indicator`/`text`. Roles must exist in the official state role list. Each rule has a default `unit` (only where unambiguous, e.g. none for `speed`) with its `min`/`max`, and `units` recognized as tokens in the name (`power_kW`; the display unit is matched too, longest first). A unit from the name drops the range unless it is the default unit; `percent`/`pct` in any name gives % 0-100; a first value outside the range drops unit and range.
- `src/lib/web.ts` - default-exported web extension class (`common.webExtension: build/lib/web.js`). Mounts `app.use('/<native.route>')` on web's express app; `unload()` only deactivates the handler. Web's body parsers only run when web has authentication enabled, so `readBody` uses `req.rawBody`/`req.body` if present and reads the stream otherwise.
- `src/main.ts` - in extension mode it sets `info.extension`, sets `alive` false and terminates with `ADAPTER_REQUESTED_TERMINATION`; otherwise it starts the standalone server on `native.port` (default 8095). After listening it registers the port with `registerUsedResource('tcpPort')` (js-controller 8, probed at runtime because `@iobroker/types` doesn't know it yet; `common.declareUsedResources: true`, otherwise the host would seed `native.port` even in extension mode). On `EADDRINUSE` it asks `checkUsedResource` for the holder. The check is deliberately not done before `listen`: without a host (testing harness) it waits 5 s for a timeout.

Adding a config option: `io-package.json` `native` (default), `src/lib/adapter-config.d.ts`, `admin/jsonConfig.json`, and the label in all 11 `admin/i18n/<lang>.json` files - keep the key sets identical, otherwise saving the config drops values.

## Conventions

- `REFACTORING.md` is the general ioBroker modernization guide this adapter was migrated with.
- Don't edit `common.news` or the version by hand; add changelog lines under `### **WORK IN PROGRESS**` in README.md.
