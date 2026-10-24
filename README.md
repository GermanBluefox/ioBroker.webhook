![Logo](admin/webhook.png)

# ioBroker Webhook Adapter

Der ioBroker Webhook Adapter ermöglicht es, HTTP-Anfragen zu empfangen und die Daten in ioBroker-Objekte zu speichern. Dies ist nützlich, um Daten von externen Diensten oder Geräten in ioBroker zu integrieren.

## Installation

1. Klone das Repository oder lade die Dateien herunter.
2. Navigiere in das Verzeichnis des Adapters, installiere die Abhängigkeiten und baue den Adapter (der Quellcode liegt als TypeScript in `src/`):
   ```bash
   npm ci
   npm run build
   ```
3. Starte den Adapter über die ioBroker Admin-Oberfläche oder über die Kommandozeile:
   ```bash
   iobroker start webhook
   ```

## Konfiguration

Der Adapter kann über die ioBroker Admin-Oberfläche konfiguriert werden. Die wichtigsten Konfigurationsoptionen sind:

- **WEB-Adapter erweitern**: Ist hier eine `web`-Instanz (oder „alle“) ausgewählt, startet der Adapter keinen eigenen Server, sondern läuft als Erweiterung des Web-Adapters auf dessen Port (inkl. HTTPS und Authentifizierung des Web-Adapters). Die Instanz selbst beendet sich dann nach dem Start, das ist so gewollt.
- **Port**: Der Port, auf dem der eigene Webhook-Server lauscht (Standard: 8095). Nur ohne Web-Erweiterung.
- **Route**: Pfad unter dem Web-Adapter (Standard: `webhook`). Webhooks werden dann unter `http(s)://<web>:8082/webhook/<pfad>` empfangen. Nur als Web-Erweiterung.

## Funktionsweise

### Webhook-Server

Der Adapter startet einen schlanken HTTP-Server (ohne zusätzliche Abhängigkeiten), der HTTP-Anfragen auf dem konfigurierten Port empfängt – oder hängt sich als Erweiterung in den Web-Adapter ein. Die empfangenen Daten werden in ioBroker-Objekte umgewandelt und gespeichert.

### Datenverarbeitung

Die empfangenen Daten werden rekursiv verarbeitet und in ioBroker-Objekte umgewandelt. Dabei werden die Daten in zwei Kategorien unterteilt:

- **Meta-Daten**: Informationen über die Anfrage (IP-Adresse, HTTP-Methode, Zeitstempel).
- **Daten**: Bei POST, PUT und PATCH der JSON-Body (`Content-Type: application/json`, max. 100 KB), bei allen anderen Methoden die Query-Parameter (`?a=1&b[c]=2`).

### Rollen

Beim Anlegen eines Datenpunkts versucht der Adapter, anhand des Attributnamens eine passende [Rolle](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/stateroles.md) zu finden – in beliebiger Schreibweise (`outsideTemp`, `outside_temp`, `OUTSIDE-TEMP`) und für gängige englische und deutsche Begriffe, z. B.:

| Attribut | Typ | Rolle |
|---|---|---|
| `temperature`, `temp`, `Temperatur` | Zahl | `value.temperature` |
| `humidity`, `luftfeuchtigkeit` | Zahl | `value.humidity` |
| `battery`, `akku` | Zahl / Boolean | `value.battery` / `indicator.lowbat` |
| `co2`, `pm2_5`, `voc` | Zahl | `value.co2`, `value.pm25`, `value.tvoc` |
| `power`, `voltage`, `energy` | Zahl | `value.power`, `value.voltage`, `value.energy` |
| `motion`, `door`, `window`, `fenster` | Boolean | `sensor.motion`, `sensor.door`, `sensor.window` |
| `lat`, `lon` | Zahl | `value.gps.latitude`, `value.gps.longitude` |
| `ip`, `timestamp` | Text | `info.ip`, `date` |

Ist der Name selbst unbekannt, wird der übergeordnete Name verwendet: `{"temperature": {"value": 21}}` oder `/temperatur?value=21` ergeben ebenfalls `value.temperature`. Ohne Treffer gilt je nach Typ `value`, `indicator` oder `text`.

Für Zahlen werden zusätzlich Einheit sowie `min`/`max` gesetzt, wo sie eindeutig sind:

| Attribut | Einheit | min / max |
|---|---|---|
| `temperature` | °C | – |
| `humidity`, `battery`, `clouds`, `dimmer`, `position` | % | 0 / 100 |
| `windDirection`, `heading` | ° | 0 / 360 |
| `lat` / `lon` | ° | -90 / 90 bzw. -180 / 180 |
| `pressure` | hPa | – |
| `power`, `voltage`, `current`, `energy` | W, V, A, kWh | – |
| `co2`, `pm2_5`, `rssi` | ppm, µg/m³, dBm | – |

Eine Einheit im Namen hat Vorrang: `tempF` → °F, `power_kW` → kW, `energyWh` → Wh, `windSpeedKmh` → km/h, `pressure_pa` → Pa, `battery_mV` → mV. Namen mit `percent`/`pct`/`prozent` bekommen immer % und 0–100. Bei mehrdeutigen Größen wie `speed` oder `distance` wird nur eine Einheit aus dem Namen übernommen. Liegt der erste empfangene Wert außerhalb von `min`/`max` (z. B. `battery: 3000`), war die Vermutung falsch und Einheit und Grenzen entfallen.

Rolle, Einheit und Grenzen werden nur beim ersten Anlegen gesetzt – von Hand geänderte Werte bleiben erhalten, bestehende Datenpunkte werden nicht angepasst.

Unzulässige Zeichen in Pfad und Attributnamen werden durch `_` ersetzt. Zahlen in Textform (z. B. Query-Parameter) werden als Zahl gespeichert, wenn das verlustfrei geht – `"007"` bleibt Text.

### Pfadverarbeitung

Der Adapter verarbeitet auch Pfade in den URLs der HTTP-Anfragen und speichert die Daten entsprechend der Pfadstruktur in ioBroker-Objekten. Zum Beispiel wird eine Anfrage an `/wohnzimmer/fenster` in die entsprechenden Pfade in ioBroker umgewandelt.

### Beispiel

Angenommen, eine HTTP-POST-Anfrage wird an den Adapter gesendet mit folgendem JSON-Body:

```json
{
	"temperature": 22.5,
	"humidity": 60
}
```

Der Adapter speichert die Daten in den folgenden ioBroker-Objekten:

- `webhook.0.wohnzimmer.fenster.data.temperature`
- `webhook.0.wohnzimmer.fenster.data.humidity`

Zusätzlich werden Meta-Daten gespeichert:

- `webhook.0.wohnzimmer.fenster.meta.ip`
- `webhook.0.wohnzimmer.fenster.meta.method`
- `webhook.0.wohnzimmer.fenster.meta.timestamp`

## Ereignisse

Der Adapter registriert die folgenden Ereignisse:

- **ready**: Wird ausgelöst, wenn der Adapter bereit ist.
- **stateChange**: Wird ausgelöst, wenn sich der Zustand eines Objekts ändert.
- **unload**: Wird ausgelöst, wenn der Adapter entladen wird.

## Fehlerbehandlung

Der Adapter behandelt Fehler beim Starten und Stoppen des Servers und protokolliert entsprechende Fehlermeldungen.

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
- (bluefox) Fixed: the adapter crashed if the port was in use, on `null` values and on characters that are not allowed in IDs (these are replaced by `_` now)
- (bluefox) Fixed: numeric strings (e.g. query parameters) are stored as numbers, if this is lossless (`"007"` stays a string)
- (bluefox) Fixed: a request to `/` is stored directly below `webhook.X` instead of `webhook.X.undefined`
- (bluefox) The JSON body of PUT and PATCH requests is stored too
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

Copyright (c) 2025 MrErdnuss <thomas.dick@inkblot.de>

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
