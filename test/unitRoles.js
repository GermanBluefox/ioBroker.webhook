'use strict';

// Tests build/lib/roles.js (run `npm run build` first)
const assert = require('node:assert');

const { detectRole } = require('../build/lib/roles');

describe('detectRole', () => {
    it('should detect roles in any notation', () => {
        assert.strictEqual(detectRole('temperature', 'number'), 'value.temperature');
        assert.strictEqual(detectRole('outsideTemp', 'number'), 'value.temperature');
        assert.strictEqual(detectRole('OUTSIDE_TEMP', 'number'), 'value.temperature');
        assert.strictEqual(detectRole('temp-1', 'number'), 'value.temperature');
        assert.strictEqual(detectRole('dewPoint', 'number'), 'value.temperature.dewpoint');
        assert.strictEqual(detectRole('CO2Level', 'number'), 'value.co2');
        assert.strictEqual(detectRole('pm2_5', 'number'), 'value.pm25');
        assert.strictEqual(detectRole('pm10', 'number'), 'value.pm10');
        assert.strictEqual(detectRole('windSpeed', 'number'), 'value.speed.wind');
    });

    it('should detect German names', () => {
        assert.strictEqual(detectRole('Temperatur', 'number'), 'value.temperature');
        assert.strictEqual(detectRole('luftfeuchtigkeit', 'number'), 'value.humidity');
        assert.strictEqual(detectRole('tür', 'boolean'), 'sensor.door');
        assert.strictEqual(detectRole('fensterOffen', 'boolean'), 'sensor.window');
    });

    it('should take the type into account', () => {
        assert.strictEqual(detectRole('battery', 'number'), 'value.battery');
        assert.strictEqual(detectRole('battery', 'boolean'), 'indicator.lowbat');
        assert.strictEqual(detectRole('battery_voltage', 'number'), 'value.voltage');
        assert.strictEqual(detectRole('current_power', 'number'), 'value.power');
        assert.strictEqual(detectRole('current', 'number'), 'value.current');
        assert.strictEqual(detectRole('timestamp', 'string'), 'date');
        assert.strictEqual(detectRole('timestamp', 'number'), 'value.time');
        assert.strictEqual(detectRole('ip', 'string'), 'info.ip');
        // "temperature" has no role for strings
        assert.strictEqual(detectRole('temperature', 'string'), 'text');
    });

    it('should use the parent name if the name is not known', () => {
        assert.strictEqual(detectRole('value', 'number', 'temperature'), 'value.temperature');
        assert.strictEqual(detectRole('battery', 'number', 'temperature'), 'value.battery');
    });

    it('should fall back to generic roles', () => {
        assert.strictEqual(detectRole('foo', 'number'), 'value');
        assert.strictEqual(detectRole('foo', 'boolean'), 'indicator');
        assert.strictEqual(detectRole('foo', 'string'), 'text');
        assert.strictEqual(detectRole('foo', 'mixed'), 'state');
        assert.strictEqual(detectRole('', 'number'), 'value');
        // whole words only
        assert.strictEqual(detectRole('template', 'number'), 'value');
        assert.strictEqual(detectRole('combat', 'number'), 'value');
    });
});
