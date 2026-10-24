"use strict";
/**
 * Guesses role, unit and range of a state from the name of a received attribute.
 * Roles: https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/stateroles.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCommon = detectCommon;
const PERCENT = { unit: '%', min: 0, max: 100 };
const TEMPERATURE = {
    unit: '°C',
    units: { c: '°C', celsius: '°C', f: '°F', fahrenheit: '°F', k: 'K', kelvin: 'K' },
};
const SPEED = { units: { kmh: 'km/h', 'km h': 'km/h', kph: 'km/h', ms: 'm/s', 'm s': 'm/s', mph: 'mph', kn: 'kn' } };
const LENGTH = { units: { mm: 'mm', cm: 'cm', m: 'm', km: 'km' } };
const DEGREES = { unit: '°', min: 0, max: 360 };
const ENERGY = { unit: 'kWh', units: { wh: 'Wh', kwh: 'kWh', mwh: 'MWh' } };
const MICROGRAMS = { unit: 'µg/m³' };
/** In every name, independent of the rule: `level_percent` */
const PERCENT_NAMES = ['percent', 'percentage', 'pct', 'prozent'];
/** The first matching rule with a role for the type wins, so specific rules come first */
const RULES = [
    // weather
    { names: ['dew point', 'dewpoint'], number: 'value.temperature.dewpoint', ...TEMPERATURE },
    {
        names: ['feels like', 'feelslike', 'apparent temperature'],
        number: 'value.temperature.feelslike',
        ...TEMPERATURE,
    },
    { names: ['wind chill', 'windchill'], number: 'value.temperature.windchill', ...TEMPERATURE },
    {
        names: ['temperature min', 'temp min', 'min temperature', 'min temp'],
        number: 'value.temperature.min',
        ...TEMPERATURE,
    },
    {
        names: ['temperature max', 'temp max', 'max temperature', 'max temp'],
        number: 'value.temperature.max',
        ...TEMPERATURE,
    },
    { names: ['wind gust', 'gust'], number: 'value.speed.wind.gust', ...SPEED },
    { names: ['wind speed', 'windspeed', 'windgeschwindigkeit'], number: 'value.speed.wind', ...SPEED },
    {
        names: ['wind direction', 'wind dir', 'winddir', 'wind bearing', 'windrichtung'],
        number: 'value.direction.wind',
        ...DEGREES,
    },
    {
        names: ['temperature', 'temp', 'tmp', 'celsius', 'fahrenheit', 'temperatur'],
        number: 'value.temperature',
        ...TEMPERATURE,
    },
    { names: ['absolute humidity'], number: 'value.humidity.absolute', unit: 'g/m³' },
    {
        names: ['humidity', 'hum', 'rh', 'luftfeuchtigkeit', 'luftfeuchte', 'feuchtigkeit', 'feuchte'],
        number: 'value.humidity',
        ...PERCENT,
    },
    {
        names: ['pressure', 'baro', 'barometer', 'hpa', 'luftdruck', 'druck'],
        number: 'value.pressure',
        unit: 'hPa',
        units: { hpa: 'hPa', pa: 'Pa', kpa: 'kPa', mbar: 'mbar', bar: 'bar', inhg: 'inHg', mmhg: 'mmHg', psi: 'psi' },
    },
    {
        names: ['precipitation', 'rain', 'niederschlag', 'regen'],
        number: 'value.precipitation',
        boolean: 'sensor.rain',
        unit: 'mm',
        units: { mm: 'mm', inch: 'in' },
    },
    { names: ['snow'], number: 'value.snow', ...LENGTH },
    { names: ['clouds', 'cloud cover', 'cloudiness'], number: 'value.clouds', ...PERCENT },
    { names: ['uv', 'uv index', 'uvi'], number: 'value.uv', min: 0 },
    {
        names: ['illuminance', 'illumination', 'lux', 'brightness', 'helligkeit'],
        number: 'value.brightness',
        unit: 'lux',
    },
    { names: ['light'], number: 'value.brightness', boolean: 'sensor.light', unit: 'lux' },
    // air quality
    { names: ['co2', 'carbon dioxide'], number: 'value.co2', unit: 'ppm' },
    { names: ['co', 'carbon monoxide'], number: 'value.co', boolean: 'sensor.alarm.co', unit: 'ppm' },
    { names: ['no2'], number: 'value.no2', ...MICROGRAMS },
    { names: ['o3', 'ozone'], number: 'value.o3', ...MICROGRAMS },
    { names: ['pm1'], number: 'value.pm1', ...MICROGRAMS },
    { names: ['pm25', 'pm2 5'], number: 'value.pm25', ...MICROGRAMS },
    { names: ['pm10'], number: 'value.pm10', ...MICROGRAMS },
    { names: ['tvoc', 'voc'], number: 'value.tvoc', unit: 'ppb', units: { ppb: 'ppb', ppm: 'ppm' } },
    { names: ['radon'], number: 'value.rn', unit: 'Bq/m³' },
    { names: ['aqi', 'air quality'], number: 'value.airquality', min: 0 },
    // electricity: before "battery" (battery_voltage) and "current" last (current_power)
    { names: ['low bat', 'lowbat', 'battery low'], boolean: 'indicator.lowbat' },
    {
        names: ['voltage', 'volt', 'volts', 'spannung'],
        number: 'value.voltage',
        unit: 'V',
        units: { v: 'V', mv: 'mV', kv: 'kV' },
    },
    { names: ['energy produced', 'production', 'yield'], number: 'value.energy.produced', ...ENERGY },
    { names: ['energy consumed', 'consumption', 'verbrauch'], number: 'value.energy.consumed', ...ENERGY },
    { names: ['energy', 'kwh', 'energie'], number: 'value.energy', ...ENERGY },
    {
        names: ['power', 'watt', 'watts', 'kw', 'leistung'],
        number: 'value.power',
        unit: 'W',
        units: { w: 'W', kw: 'kW' },
    },
    { names: ['frequency', 'freq', 'hz'], number: 'value.frequency', unit: 'Hz' },
    {
        names: ['current', 'ampere', 'amps', 'stromstärke'],
        number: 'value.current',
        unit: 'A',
        units: { a: 'A', ma: 'mA' },
    },
    {
        names: ['battery', 'bat', 'batt', 'soc', 'batterie', 'akku'],
        number: 'value.battery',
        boolean: 'indicator.lowbat',
        ...PERCENT,
        units: { v: 'V', mv: 'mV' },
    },
    // position and movement
    { names: ['latitude', 'lat'], number: 'value.gps.latitude', unit: '°', min: -90, max: 90 },
    { names: ['longitude', 'lon', 'lng'], number: 'value.gps.longitude', unit: '°', min: -180, max: 180 },
    { names: ['altitude', 'elevation'], number: 'value.gps.elevation', unit: 'm', units: { m: 'm', ft: 'ft' } },
    { names: ['accuracy'], number: 'value.gps.accuracy', unit: 'm' },
    { names: ['speed', 'velocity', 'geschwindigkeit'], number: 'value.speed', ...SPEED },
    { names: ['direction', 'heading', 'bearing', 'richtung'], number: 'value.direction', ...DEGREES },
    { names: ['distance', 'entfernung', 'abstand'], number: 'value.distance', ...LENGTH },
    { names: ['position'], number: 'value.position', ...PERCENT },
    { names: ['tilt'], number: 'value.tilt', ...PERCENT },
    { names: ['valve'], number: 'value.valve', ...PERCENT },
    { names: ['dimmer'], number: 'value.dimmer', ...PERCENT },
    { names: ['progress'], number: 'value.progress', ...PERCENT },
    { names: ['fill', 'fill level'], number: 'value.fill', units: { l: 'l', ml: 'ml', m3: 'm³' } },
    // sensors and indicators
    { names: ['flood', 'leak', 'water leak', 'leck'], boolean: 'sensor.alarm.flood' },
    { names: ['smoke', 'fire', 'rauch'], boolean: 'sensor.alarm.fire' },
    {
        names: ['motion', 'presence', 'occupancy', 'movement', 'pir', 'bewegung', 'anwesenheit'],
        boolean: 'sensor.motion',
    },
    { names: ['door', 'tür', 'tuer'], boolean: 'sensor.door' },
    { names: ['window', 'fenster'], boolean: 'sensor.window' },
    { names: ['contact', 'open', 'opened', 'kontakt', 'offen'], boolean: 'sensor.contact' },
    { names: ['lock', 'locked'], boolean: 'sensor.lock' },
    { names: ['alarm'], boolean: 'sensor.alarm' },
    { names: ['reachable', 'online', 'available'], boolean: 'indicator.reachable' },
    { names: ['connected', 'connection'], boolean: 'indicator.connected' },
    { names: ['error', 'fault', 'failure', 'fehler', 'störung'], boolean: 'indicator.error' },
    { names: ['maintenance'], boolean: 'indicator.maintenance' },
    { names: ['working', 'running', 'busy'], boolean: 'indicator.working' },
    { names: ['rssi'], number: 'value.rssi', unit: 'dBm' },
    { names: ['signal'], number: 'value.rssi' },
    // health
    { names: ['heart rate', 'bpm', 'pulse'], number: 'value.health.bpm', unit: 'bpm', min: 0 },
    { names: ['steps'], number: 'value.health.steps', min: 0 },
    { names: ['calories'], number: 'value.health.calories', unit: 'kcal', min: 0 },
    {
        names: ['weight', 'gewicht'],
        number: 'value.health.weight',
        unit: 'kg',
        units: { kg: 'kg', lb: 'lb', lbs: 'lb' },
    },
    { names: ['bmi'], number: 'value.health.bmi' },
    // information
    { names: ['ip', 'ip address'], string: 'info.ip' },
    { names: ['mac', 'mac address'], string: 'info.mac' },
    { names: ['firmware', 'fw', 'version'], string: 'info.firmware' },
    { names: ['serial', 'serial number'], string: 'info.serial' },
    { names: ['model'], string: 'info.model' },
    { names: ['hardware'], string: 'info.hardware' },
    { names: ['address'], string: 'info.address' },
    { names: ['status'], string: 'info.status' },
    { names: ['name'], string: 'info.name' },
    { names: ['url', 'uri', 'link', 'href'], string: 'text.url' },
    { names: ['phone', 'phone number', 'tel'], string: 'text.phone' },
    {
        names: ['timestamp', 'ts', 'time', 'date', 'datetime', 'created at', 'updated at', 'last seen'],
        number: 'value.time',
        string: 'date',
    },
];
/** Roles if no rule matches */
const DEFAULT_ROLES = { number: 'value', boolean: 'indicator', string: 'text' };
/** `outsideTemp`, `outside_temp`, `Outside-Temp`, `CO2Level` -> `outside_temp`, `co_2_level` */
function normalize(name) {
    return name
        .replace(/(\p{Ll})(\p{Lu})/gu, '$1_$2')
        .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1_$2')
        .replace(/(\p{L})(\d)/gu, '$1_$2')
        .replace(/(\d)(\p{L})/gu, '$1_$2')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .join('_');
}
/** Matches whole words of a normalized name */
function wordRegex(names) {
    return new RegExp(`(?:^|_)(?:${names.map(normalize).join('|')})(?:_|$)`, 'u');
}
const COMPILED = RULES.map(rule => ({
    rule,
    regex: wordRegex(rule.names),
    // "power_kw" and "power_kW" (normalized to "power_k_w"), longest first: "k_w" before "w"
    units: Object.entries(rule.units ?? {})
        .sort(([a], [b]) => b.length - a.length)
        .map(([name, unit]) => ({ regex: wordRegex([name, unit]), unit })),
}));
const PERCENT_REGEX = wordRegex(PERCENT_NAMES);
function findRule(normalized, type) {
    return normalized ? COMPILED.find(({ rule, regex }) => rule[type] && regex.test(normalized)) : undefined;
}
/** Unit and range of a number: a unit in the name wins over the default unit of the rule */
function detectUnit(compiled, names) {
    if (names.some(name => PERCENT_REGEX.test(name))) {
        return PERCENT;
    }
    const rule = compiled?.rule;
    for (const name of names) {
        const unit = compiled?.units.find(({ regex }) => regex.test(name))?.unit;
        if (unit) {
            // the range belongs to the default unit: battery 0-100 %, but not in mV
            return unit === rule?.unit ? { unit, min: rule.min, max: rule.max } : { unit };
        }
    }
    return { unit: rule?.unit, min: rule?.min, max: rule?.max };
}
/**
 * Guesses `role`, `unit`, `min` and `max` from the attribute name.
 *
 * @param name attribute name, e.g. `outsideTemperature`
 * @param value the first received value, which defines the type
 * @param parentName name of the parent attribute: `{ "temperature": { "value": 21 } }`
 */
function detectCommon(name, value, parentName) {
    const type = value === null ? undefined : typeof value;
    if (!type) {
        return { role: 'state' };
    }
    const own = normalize(name);
    const parent = normalize(parentName ?? '');
    const compiled = findRule(own, type) ?? findRule(parent, type);
    const result = { role: compiled?.rule[type] ?? DEFAULT_ROLES[type] };
    if (typeof value !== 'number') {
        return result;
    }
    const { unit, min, max } = detectUnit(compiled, [own, parent].filter(Boolean));
    // A value outside the range shows that the guess is wrong, e.g. a battery voltage of 3000 (mV)
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
        return result;
    }
    if (unit !== undefined) {
        result.unit = unit;
    }
    if (min !== undefined) {
        result.min = min;
    }
    if (max !== undefined) {
        result.max = max;
    }
    return result;
}
//# sourceMappingURL=roles.js.map