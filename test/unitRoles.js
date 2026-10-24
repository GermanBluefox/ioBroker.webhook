'use strict';

// Tests build/lib/roles.js (run `npm run build` first)
const assert = require('node:assert');

const { detectCommon } = require('../build/lib/roles');

const role = (name, value, parentName) => detectCommon(name, value, parentName).role;

describe('detectCommon', () => {
    it('should detect roles in any notation', () => {
        assert.strictEqual(role('temperature', 1), 'value.temperature');
        assert.strictEqual(role('outsideTemp', 1), 'value.temperature');
        assert.strictEqual(role('OUTSIDE_TEMP', 1), 'value.temperature');
        assert.strictEqual(role('temp-1', 1), 'value.temperature');
        assert.strictEqual(role('dewPoint', 1), 'value.temperature.dewpoint');
        assert.strictEqual(role('temp_min', 1), 'value.temperature.min');
        assert.strictEqual(role('CO2Level', 1), 'value.co2');
        assert.strictEqual(role('pm2_5', 1), 'value.pm25');
        assert.strictEqual(role('pm10', 1), 'value.pm10');
        assert.strictEqual(role('windSpeed', 1), 'value.speed.wind');
    });

    it('should detect German names', () => {
        assert.strictEqual(role('Temperatur', 1), 'value.temperature');
        assert.strictEqual(role('luftfeuchtigkeit', 1), 'value.humidity');
        assert.strictEqual(role('tür', true), 'sensor.door');
        assert.strictEqual(role('fensterOffen', true), 'sensor.window');
    });

    it('should take the type into account', () => {
        assert.strictEqual(role('battery', 1), 'value.battery');
        assert.strictEqual(role('battery', true), 'indicator.lowbat');
        assert.strictEqual(role('battery_voltage', 1), 'value.voltage');
        assert.strictEqual(role('current_power', 1), 'value.power');
        assert.strictEqual(role('current', 1), 'value.current');
        assert.strictEqual(role('timestamp', 'x'), 'date');
        assert.strictEqual(role('timestamp', 1), 'value.time');
        assert.strictEqual(role('ip', 'x'), 'info.ip');
        // "temperature" has no role for strings
        assert.strictEqual(role('temperature', 'x'), 'text');
    });

    it('should use the parent name if the name is not known', () => {
        assert.strictEqual(role('value', 1, 'temperature'), 'value.temperature');
        assert.strictEqual(role('battery', 1, 'temperature'), 'value.battery');
    });

    it('should fall back to generic roles', () => {
        assert.strictEqual(role('foo', 1), 'value');
        assert.strictEqual(role('foo', true), 'indicator');
        assert.strictEqual(role('foo', 'x'), 'text');
        assert.deepStrictEqual(detectCommon('foo', null), { role: 'state' });
        assert.strictEqual(role('', 1), 'value');
        // whole words only
        assert.strictEqual(role('template', 1), 'value');
        assert.strictEqual(role('combat', 1), 'value');
    });

    it('should detect units and ranges', () => {
        assert.deepStrictEqual(detectCommon('temperature', 21.5), { role: 'value.temperature', unit: '°C' });
        assert.deepStrictEqual(detectCommon('humidity', 45), { role: 'value.humidity', unit: '%', min: 0, max: 100 });
        assert.deepStrictEqual(detectCommon('windDirection', 270), {
            role: 'value.direction.wind',
            unit: '°',
            min: 0,
            max: 360,
        });
        assert.deepStrictEqual(detectCommon('lat', 51.05), {
            role: 'value.gps.latitude',
            unit: '°',
            min: -90,
            max: 90,
        });
        assert.deepStrictEqual(detectCommon('power', 230), { role: 'value.power', unit: 'W' });
        assert.deepStrictEqual(detectCommon('co2', 600), { role: 'value.co2', unit: 'ppm' });
        // no unit if it is not clear: m/s, km/h or mph
        assert.deepStrictEqual(detectCommon('speed', 10), { role: 'value.speed' });
        // only numbers have units
        assert.deepStrictEqual(detectCommon('humidity', true), { role: 'indicator' });
    });

    it('should take the unit from the name', () => {
        assert.deepStrictEqual(detectCommon('tempF', 70), { role: 'value.temperature', unit: '°F' });
        assert.deepStrictEqual(detectCommon('temperature_celsius', 20), { role: 'value.temperature', unit: '°C' });
        assert.deepStrictEqual(detectCommon('power_kW', 1.2), { role: 'value.power', unit: 'kW' });
        assert.deepStrictEqual(detectCommon('energyWh', 1200), { role: 'value.energy', unit: 'Wh' });
        assert.deepStrictEqual(detectCommon('windSpeedKmh', 12), { role: 'value.speed.wind', unit: 'km/h' });
        assert.deepStrictEqual(detectCommon('wind_speed_m_s', 3), { role: 'value.speed.wind', unit: 'm/s' });
        assert.deepStrictEqual(detectCommon('pressure_pa', 101325), { role: 'value.pressure', unit: 'Pa' });
        assert.deepStrictEqual(detectCommon('pressure_hPa', 1013), { role: 'value.pressure', unit: 'hPa' });
        assert.deepStrictEqual(detectCommon('voltage_mV', 3300), { role: 'value.voltage', unit: 'mV' });
        // the range belongs to the default unit
        assert.deepStrictEqual(detectCommon('battery_mv', 3000), { role: 'value.battery', unit: 'mV' });
        // percent in any name
        assert.deepStrictEqual(detectCommon('level_percent', 50), { role: 'value', unit: '%', min: 0, max: 100 });
        // from the parent
        assert.deepStrictEqual(detectCommon('value', 3, 'power_kw'), { role: 'value.power', unit: 'kW' });
        // units belong to the rule: "a" is no unit of a voltage
        assert.deepStrictEqual(detectCommon('voltage_a', 230), { role: 'value.voltage', unit: 'V' });
    });

    it('should drop unit and range if the first value does not fit', () => {
        assert.deepStrictEqual(detectCommon('battery', 3000), { role: 'value.battery' });
        assert.deepStrictEqual(detectCommon('direction', -5), { role: 'value.direction' });
    });
});
