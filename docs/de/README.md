![Logo](../../admin/webhook.svg)

# ioBroker Webhook Adapter

Der Webhook-Adapter empfängt HTTP-Anfragen und speichert die übermittelten Daten als ioBroker-Datenpunkte. Damit lassen sich Daten von externen Diensten oder Geräten, die Webhooks senden können, ohne weiteren Code in ioBroker integrieren.

## Installation

Der Adapter wird wie jeder andere Adapter über die ioBroker Admin-Oberfläche installiert.

Für die Entwicklung: Repository klonen, Abhängigkeiten installieren und bauen (der Quellcode liegt als TypeScript in `src/`):

```bash
npm ci
npm run build
```

## Konfiguration

- **WEB-Adapter erweitern**: Ist hier eine `web`-Instanz (oder „alle“) ausgewählt, startet der Adapter keinen eigenen Server, sondern läuft als Erweiterung des Web-Adapters auf dessen Port (inkl. HTTPS und Authentifizierung des Web-Adapters). Die Instanz selbst beendet sich dann nach dem Start, das ist so gewollt.
- **Port**: Der Port, auf dem der eigene Webhook-Server lauscht (Standard: 8095). Nur ohne Web-Erweiterung.
- **Route**: Pfad unter dem Web-Adapter (Standard: `webhook`). Webhooks werden dann unter `http(s)://<web>:8082/webhook/<pfad>` empfangen. Nur als Web-Erweiterung.

## Funktionsweise

### Webhook-Server

Der Adapter startet einen schlanken HTTP-Server (ohne zusätzliche Abhängigkeiten) auf dem konfigurierten Port – oder hängt sich als Erweiterung in den Web-Adapter ein.

Ab js-controller 8 meldet der eigene Server seinen Port als belegte Ressource an den Host. Ist der Port bereits belegt, nennt die Fehlermeldung die Instanz, die ihn verwendet, z. B. `port 8095 is already used by web.0`.

### Datenverarbeitung

Die empfangenen Daten werden rekursiv verarbeitet, für jeden einzelnen Wert wird ein Datenpunkt angelegt. Dabei werden zwei Bereiche unterschieden:

- **`meta`**: Informationen über die Anfrage (IP-Adresse, HTTP-Methode, Zeitstempel).
- **`data`**: Bei POST, PUT und PATCH der JSON-Body (`Content-Type: application/json`, max. 100 KB), bei allen anderen Methoden die Query-Parameter (`?a=1&b[c]=2`).

Unzulässige Zeichen in Pfad und Attributnamen werden durch `_` ersetzt. Zahlen in Textform (z. B. Query-Parameter) werden als Zahl gespeichert, wenn das verlustfrei geht – `"007"` bleibt Text.

### Pfadverarbeitung

Der Pfad der URL bestimmt, wo die Daten abgelegt werden: Eine Anfrage an `/wohnzimmer/fenster` landet unter `webhook.0.wohnzimmer.fenster.*`, eine Anfrage an `/` direkt unter `webhook.0.*`.

### Rollen

Beim Anlegen eines Datenpunkts versucht der Adapter, anhand des Attributnamens eine passende [Rolle](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/stateroles.md) zu finden – in beliebiger Schreibweise (`outsideTemp`, `outside_temp`, `OUTSIDE-TEMP`) und für gängige englische und deutsche Begriffe, z. B.:

| Attribut                              | Typ            | Rolle                                           |
|---------------------------------------|----------------|-------------------------------------------------|
| `temperature`, `temp`, `Temperatur`   | Zahl           | `value.temperature`                             |
| `humidity`, `luftfeuchtigkeit`        | Zahl           | `value.humidity`                                |
| `battery`, `akku`                     | Zahl / Boolean | `value.battery` / `indicator.lowbat`            |
| `co2`, `pm2_5`, `voc`                 | Zahl           | `value.co2`, `value.pm25`, `value.tvoc`         |
| `power`, `voltage`, `energy`          | Zahl           | `value.power`, `value.voltage`, `value.energy`  |
| `motion`, `door`, `window`, `fenster` | Boolean        | `sensor.motion`, `sensor.door`, `sensor.window` |
| `lat`, `lon`                          | Zahl           | `value.gps.latitude`, `value.gps.longitude`     |
| `ip`, `timestamp`                     | Text           | `info.ip`, `date`                               |

Ist der Name selbst unbekannt, wird der übergeordnete Name verwendet: `{"temperature": {"value": 21}}` oder `/temperatur?value=21` ergeben ebenfalls `value.temperature`. Ohne Treffer gilt je nach Typ `value`, `indicator` oder `text`.

### Einheiten und Grenzen

Für Zahlen werden zusätzlich Einheit sowie `min`/`max` gesetzt, wo sie eindeutig sind:

| Attribut                                              | Einheit         | min / max                |
|-------------------------------------------------------|-----------------|--------------------------|
| `temperature`                                         | °C              | –                        |
| `humidity`, `battery`, `clouds`, `dimmer`, `position` | %               | 0 / 100                  |
| `windDirection`, `heading`                            | °               | 0 / 360                  |
| `lat` / `lon`                                         | °               | -90 / 90 bzw. -180 / 180 |
| `pressure`                                            | hPa             | –                        |
| `power`, `voltage`, `current`, `energy`               | W, V, A, kWh    | –                        |
| `co2`, `pm2_5`, `rssi`                                | ppm, µg/m³, dBm | –                        |

Eine Einheit im Namen hat Vorrang: `tempF` → °F, `power_kW` → kW, `energyWh` → Wh, `windSpeedKmh` → km/h, `pressure_pa` → Pa, `battery_mV` → mV. Namen mit `percent`/`pct`/`prozent` bekommen immer % und 0–100. Bei mehrdeutigen Größen wie `speed` oder `distance` wird nur eine Einheit aus dem Namen übernommen. Liegt der erste empfangene Wert außerhalb von `min`/`max` (z. B. `battery: 3000`), war die Vermutung falsch und Einheit und Grenzen entfallen.

Rolle, Einheit und Grenzen werden nur beim ersten Anlegen gesetzt – von Hand geänderte Werte bleiben erhalten, bestehende Datenpunkte werden nicht angepasst.

### Beispiel

Eine HTTP-POST-Anfrage an `/wohnzimmer/fenster` mit folgendem JSON-Body:

```json
{
	"temperature": 22.5,
	"humidity": 60
}
```

legt diese Datenpunkte an:

- `webhook.0.wohnzimmer.fenster.data.temperature` (`value.temperature`, °C)
- `webhook.0.wohnzimmer.fenster.data.humidity` (`value.humidity`, %, 0–100)

Zusätzlich werden die Meta-Daten gespeichert:

- `webhook.0.wohnzimmer.fenster.meta.ip`
- `webhook.0.wohnzimmer.fenster.meta.method`
- `webhook.0.wohnzimmer.fenster.meta.timestamp`

Der Adapter antwortet mit `{"status": "success"}`. Ungültiges JSON wird mit `400`, ein zu großer Body mit `413` abgelehnt.
