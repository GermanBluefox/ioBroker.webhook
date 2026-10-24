![Logo](admin/webhook.svg)

# ioBroker.webhook

The webhook adapter receives HTTP requests and stores the transmitted data as ioBroker states. This integrates external services and devices that can send webhooks without writing any code.

[Deutsche Dokumentation](docs/de/README.md)

## Installation

Install the adapter like any other adapter via the ioBroker admin.

For development: clone the repository, install the dependencies and build it (the sources are TypeScript in `src/`):

```bash
npm ci
npm run build
```

## Configuration

- **Extend WEB adapter**: if a `web` instance (or "all") is selected, the adapter does not start its own server but runs as an extension of the web adapter on its port (including HTTPS and the authentication of the web adapter). The instance itself terminates after the start, this is intended.
- **Port**: the port of the own webhook server (default: 8095). Only without the web extension.
- **Route**: the path below the web adapter (default: `webhook`). Webhooks are then received under `http(s)://<web>:8082/webhook/<path>`. Only as web extension.

## How it works

### Webhook server

The adapter starts a lean HTTP server (without additional dependencies) on the configured port, or hooks into the web adapter as an extension.

With js-controller 8, the own server reports its port to the host as a used resource. If the port is already in use, the error message names the instance that holds it, e.g. `port 8095 is already used by web.0`.

### Data processing

The received data is processed recursively, one state is created for every single value. There are two parts:

- **`meta`**: information about the request (IP address, HTTP method, timestamp).
- **`data`**: for POST, PUT and PATCH the JSON body (`Content-Type: application/json`, max. 100 KB), for all other methods the query parameters (`?a=1&b[c]=2`).

Characters that are not allowed in IDs are replaced by `_`. Numbers as text (e.g. query parameters) are stored as numbers if this is lossless; `"007"` stays a string.

### Paths

The path of the URL defines where the data is stored: a request to `/livingroom/window` ends up in `webhook.0.livingroom.window.*`, a request to `/` directly in `webhook.0.*`.

### Roles

When a state is created, the adapter tries to find a matching [role](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/stateroles.md) from the attribute name, in any notation (`outsideTemp`, `outside_temp`, `OUTSIDE-TEMP`) and for common English and German terms, e.g.:

| Attribute                             | Type             | Role                                            |
|---------------------------------------|------------------|-------------------------------------------------|
| `temperature`, `temp`, `Temperatur`   | number           | `value.temperature`                             |
| `humidity`, `luftfeuchtigkeit`        | number           | `value.humidity`                                |
| `battery`, `akku`                     | number / boolean | `value.battery` / `indicator.lowbat`            |
| `co2`, `pm2_5`, `voc`                 | number           | `value.co2`, `value.pm25`, `value.tvoc`         |
| `power`, `voltage`, `energy`          | number           | `value.power`, `value.voltage`, `value.energy`  |
| `motion`, `door`, `window`, `fenster` | boolean          | `sensor.motion`, `sensor.door`, `sensor.window` |
| `lat`, `lon`                          | number           | `value.gps.latitude`, `value.gps.longitude`     |
| `ip`, `timestamp`                     | string           | `info.ip`, `date`                               |

If the name itself is unknown, the name of the parent is used: `{"temperature": {"value": 21}}` and `/temperature?value=21` result in `value.temperature` too. Without a match, the role is `value`, `indicator` or `text`, depending on the type.

### Units and ranges

For numbers, the unit and `min`/`max` are set too, where they are unambiguous:

| Attribute                                             | Unit            | min / max                 |
|-------------------------------------------------------|-----------------|---------------------------|
| `temperature`                                         | °C              | –                         |
| `humidity`, `battery`, `clouds`, `dimmer`, `position` | %               | 0 / 100                   |
| `windDirection`, `heading`                            | °               | 0 / 360                   |
| `lat` / `lon`                                         | °               | -90 / 90 and -180 / 180   |
| `pressure`                                            | hPa             | –                         |
| `power`, `voltage`, `current`, `energy`               | W, V, A, kWh    | –                         |
| `co2`, `pm2_5`, `rssi`                                | ppm, µg/m³, dBm | –                         |

A unit in the name wins: `tempF` → °F, `power_kW` → kW, `energyWh` → Wh, `windSpeedKmh` → km/h, `pressure_pa` → Pa, `battery_mV` → mV. Names with `percent`/`pct`/`prozent` always get % and 0–100. For ambiguous quantities like `speed` or `distance`, only a unit from the name is used. If the first received value is outside `min`/`max` (e.g. `battery: 3000`), the guess was wrong and unit and range are omitted.

Role, unit and range are only set when the state is created: values changed by hand are kept, existing states are not modified.

### Example

An HTTP POST request to `/livingroom/window` with this JSON body:

```json
{
	"temperature": 22.5,
	"humidity": 60
}
```

creates these states:

- `webhook.0.livingroom.window.data.temperature` (`value.temperature`, °C)
- `webhook.0.livingroom.window.data.humidity` (`value.humidity`, %, 0–100)

Additionally, the meta data is stored:

- `webhook.0.livingroom.window.meta.ip`
- `webhook.0.livingroom.window.meta.method`
- `webhook.0.livingroom.window.meta.timestamp`

The adapter answers with `{"status": "success"}`. Invalid JSON is rejected with `400`, a body that is too large with `413`.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**

- (bluefox) The adapter was refactored to TypeScript and JsonConfig
- (bluefox) Breaking change: Node.js >= 22.19 is required
- (bluefox) Role, unit and min/max of the states are detected from the attribute names (e.g. `temperature` -> `value.temperature` in °C, `power_kW` -> `value.power` in kW)
- (bluefox) The adapter can run as a web extension (option "Extend WEB adapter")
- (bluefox) express, body-parser and cors were replaced by node:http
- (bluefox) The port of the server is reported to js-controller 8 as used resource; if the port is in use, the error names the instance holding it
- (bluefox) Fixed: the adapter crashed if the port was in use, on `null` values and on characters that are not allowed in IDs (these are replaced by `_` now)
- (bluefox) Fixed: numeric strings (e.g. query parameters) are stored as numbers, if this is lossless (`"007"` stays a string)
- (bluefox) Fixed: a request to `/` is stored directly below `webhook.X` instead of `webhook.X.undefined`
- (bluefox) The JSON body of PUT and PATCH requests is stored too
- (bluefox) New SVG icon
- (bluefox) Breaking change: the adapter was renamed from `iobroker-webhook` to `webhook`. Existing `iobroker-webhook` instances must be replaced by a new `webhook` instance, the state IDs change from `iobroker-webhook.X.*` to `webhook.X.*`

### 0.2.4 (2025-01-25)

- fixing get parameters

### 0.2.3 (2025-01-25)

- readme updated

### 0.2.2 (2025-01-25)

- readme updated

### 0.2.1 (2025-01-25)

- readme updated

### 0.2.0 (2025-01-25)

- refactoring

### 0.1.10 (2025-01-24)

- bugfix

### 0.1.9 (2025-01-24)

- handle single paths

### 0.1.8 (2025-01-24)

- bugfix

### 0.1.7 (2025-01-24)

- bugfix parent path

### 0.1.6 (2025-01-24)

- bugfix

### 0.1.5 (2025-01-24)

- can handle submitted json objects

### 0.1.4 (2025-01-24)

- json response

### 0.1.3 (2025-01-24)

- number test

### 0.1.2 (2025-01-24)

- update meta and bugfix data type

### 0.1.1 (2025-01-24)

- data to objects

### 0.1.0 (2025-01-24)

- add GET

### 0.0.9 (2025-01-24)

- bugfixes...

### 0.0.8 (2025-01-24)

- bugfixes......

### 0.0.7 (2025-01-24)

- bugfixes

### 0.0.6 (2025-01-24)

- debugging

### 0.0.5 (2025-01-24)

- Default Port changed

### 0.0.4 (2025-01-24)

- Logging

### 0.0.3 (2025-01-24)

- Beschreibung der neuen Features oder Bugfixes, die in der nächsten Version kommen.

### 0.0.2 (2025-01-24)

- (MrErdnuss) initial release

## License

MIT License

Copyright (c) 2025-2026 MrErdnuss <thomas.dick@inkblot.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
