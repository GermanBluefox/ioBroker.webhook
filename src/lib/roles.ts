/**
 * Guesses the state role from the name of a received attribute.
 * Roles: https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/stateroles.md
 */

type ValueType = 'number' | 'boolean' | 'string';

interface RoleRule {
    /** Names (in any notation: `dewPoint`, `dew_point`, `DEW-POINT`) */
    names: string[];
    number?: string;
    boolean?: string;
    string?: string;
}

/** The first matching rule with a role for the type wins, so specific rules come first */
const RULES: RoleRule[] = [
    // weather
    { names: ['dew point', 'dewpoint'], number: 'value.temperature.dewpoint' },
    { names: ['feels like', 'feelslike', 'apparent temperature'], number: 'value.temperature.feelslike' },
    { names: ['wind chill', 'windchill'], number: 'value.temperature.windchill' },
    { names: ['wind gust', 'gust'], number: 'value.speed.wind.gust' },
    { names: ['wind speed', 'windspeed', 'windgeschwindigkeit'], number: 'value.speed.wind' },
    {
        names: ['wind direction', 'wind dir', 'winddir', 'wind bearing', 'windrichtung'],
        number: 'value.direction.wind',
    },
    { names: ['temperature', 'temp', 'tmp', 'celsius', 'fahrenheit', 'temperatur'], number: 'value.temperature' },
    { names: ['absolute humidity'], number: 'value.humidity.absolute' },
    {
        names: ['humidity', 'hum', 'rh', 'luftfeuchtigkeit', 'luftfeuchte', 'feuchtigkeit', 'feuchte'],
        number: 'value.humidity',
    },
    { names: ['pressure', 'baro', 'barometer', 'hpa', 'luftdruck', 'druck'], number: 'value.pressure' },
    {
        names: ['precipitation', 'rain', 'niederschlag', 'regen'],
        number: 'value.precipitation',
        boolean: 'sensor.rain',
    },
    { names: ['snow'], number: 'value.snow' },
    { names: ['clouds', 'cloud cover', 'cloudiness'], number: 'value.clouds' },
    { names: ['uv', 'uv index', 'uvi'], number: 'value.uv' },
    { names: ['illuminance', 'illumination', 'lux', 'brightness', 'helligkeit'], number: 'value.brightness' },
    { names: ['light'], number: 'value.brightness', boolean: 'sensor.light' },

    // air quality
    { names: ['co2', 'carbon dioxide'], number: 'value.co2' },
    { names: ['co', 'carbon monoxide'], number: 'value.co', boolean: 'sensor.alarm.co' },
    { names: ['no2'], number: 'value.no2' },
    { names: ['o3', 'ozone'], number: 'value.o3' },
    { names: ['pm1'], number: 'value.pm1' },
    { names: ['pm25', 'pm2 5'], number: 'value.pm25' },
    { names: ['pm10'], number: 'value.pm10' },
    { names: ['tvoc', 'voc'], number: 'value.tvoc' },
    { names: ['radon'], number: 'value.rn' },
    { names: ['aqi', 'air quality'], number: 'value.airquality' },

    // electricity: before "battery" (battery_voltage) and "current" last (current_power)
    { names: ['low bat', 'lowbat', 'battery low'], boolean: 'indicator.lowbat' },
    { names: ['voltage', 'volt', 'volts', 'spannung'], number: 'value.voltage' },
    { names: ['energy produced', 'production', 'yield'], number: 'value.energy.produced' },
    { names: ['energy consumed', 'consumption', 'verbrauch'], number: 'value.energy.consumed' },
    { names: ['energy', 'kwh', 'energie'], number: 'value.energy' },
    { names: ['power', 'watt', 'watts', 'leistung'], number: 'value.power' },
    { names: ['frequency', 'freq', 'hz'], number: 'value.frequency' },
    { names: ['current', 'ampere', 'amps', 'stromstärke'], number: 'value.current' },
    {
        names: ['battery', 'bat', 'batt', 'soc', 'batterie', 'akku'],
        number: 'value.battery',
        boolean: 'indicator.lowbat',
    },

    // position and movement
    { names: ['latitude', 'lat'], number: 'value.gps.latitude' },
    { names: ['longitude', 'lon', 'lng'], number: 'value.gps.longitude' },
    { names: ['altitude', 'elevation'], number: 'value.gps.elevation' },
    { names: ['accuracy'], number: 'value.gps.accuracy' },
    { names: ['speed', 'velocity', 'geschwindigkeit'], number: 'value.speed' },
    { names: ['direction', 'heading', 'bearing', 'richtung'], number: 'value.direction' },
    { names: ['distance', 'entfernung', 'abstand'], number: 'value.distance' },
    { names: ['position'], number: 'value.position' },
    { names: ['tilt'], number: 'value.tilt' },
    { names: ['valve'], number: 'value.valve' },
    { names: ['dimmer'], number: 'value.dimmer' },
    { names: ['progress'], number: 'value.progress' },
    { names: ['fill', 'fill level'], number: 'value.fill' },

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
    { names: ['rssi', 'signal'], number: 'value.rssi' },

    // health
    { names: ['heart rate', 'bpm', 'pulse'], number: 'value.health.bpm' },
    { names: ['steps'], number: 'value.health.steps' },
    { names: ['calories'], number: 'value.health.calories' },
    { names: ['weight', 'gewicht'], number: 'value.health.weight' },
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
const DEFAULT_ROLES: Record<ValueType, string> = { number: 'value', boolean: 'indicator', string: 'text' };

/** `outsideTemp`, `outside_temp`, `Outside-Temp`, `CO2Level` -> `outside_temp`, `co_2_level` */
function normalize(name: string): string {
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

/** One regular expression per rule, matching whole words of the normalized name */
const COMPILED = RULES.map(rule => ({
    rule,
    regex: new RegExp(`(?:^|_)(?:${rule.names.map(normalize).join('|')})(?:_|$)`, 'u'),
}));

function findRole(name: string, type: ValueType): string | undefined {
    const normalized = normalize(name);
    return normalized
        ? COMPILED.find(({ rule, regex }) => rule[type] && regex.test(normalized))?.rule[type]
        : undefined;
}

/**
 * @param name attribute name, e.g. `outsideTemperature`
 * @param type type of the value (`common.type`)
 * @param parentName name of the parent attribute: `{ "temperature": { "value": 21 } }`
 */
export function detectRole(name: string, type: ioBroker.CommonType, parentName?: string): string {
    if (type !== 'number' && type !== 'boolean' && type !== 'string') {
        return 'state';
    }
    return findRole(name, type) ?? (parentName ? findRole(parentName, type) : undefined) ?? DEFAULT_ROLES[type];
}
