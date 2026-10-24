![Logo](admin/iobroker-webhook.png)

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
   iobroker start iobroker-webhook
   ```

## Konfiguration

Der Adapter kann über die ioBroker Admin-Oberfläche konfiguriert werden. Die wichtigsten Konfigurationsoptionen sind:

- **Port**: Der Port, auf dem der Webhook-Server lauscht (Standard: 8095).

## Funktionsweise

### Webhook-Server

Der Adapter startet einen Express-Server, der HTTP-Anfragen auf dem konfigurierten Port empfängt. Die empfangenen Daten werden in ioBroker-Objekte umgewandelt und gespeichert.

### Datenverarbeitung

Die empfangenen Daten werden rekursiv verarbeitet und in ioBroker-Objekte umgewandelt. Dabei werden die Daten in zwei Kategorien unterteilt:

- **Meta-Daten**: Informationen über die Anfrage (IP-Adresse, HTTP-Methode, Zeitstempel).
- **Daten**: Die eigentlichen Daten aus dem Anfrage-Body.

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

- `webhook.wohnzimmer.fenster.data.temperature`
- `webhook.wohnzimmer.fenster.data.humidity`

Zusätzlich werden Meta-Daten gespeichert:

- `webhook.wohnzimmer.fenster.meta.ip`
- `webhook.wohnzimmer.fenster.meta.method`
- `webhook.wohnzimmer.fenster.meta.timestamp`

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
