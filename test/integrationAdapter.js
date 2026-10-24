'use strict';

const path = require('node:path');
const assert = require('node:assert');
const { tests } = require('@iobroker/testing');

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Receive webhooks', getHarness => {
            it('should store the JSON body as states with roles and units', async function () {
                this.timeout(30_000);
                const harness = getHarness();
                await harness.changeAdapterConfig('webhook', { native: { port: 18095 } });
                await harness.startAdapterAndWait();
                // wait for the server
                await new Promise(resolve => setTimeout(resolve, 1000));

                const res = await fetch('http://127.0.0.1:18095/garten/sensor?battery=95', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        temperature: 21.5,
                        humidity: 55,
                        'door*open': true,
                        nothing: null,
                        level: '3',
                    }),
                });
                assert.strictEqual(res.status, 200);

                const temperature = await harness.objects.getObjectAsync('webhook.0.garten.sensor.data.temperature');
                assert.strictEqual(temperature.common.role, 'value.temperature');
                assert.strictEqual(temperature.common.unit, '°C');
                assert.strictEqual((await harness.states.getStateAsync(temperature._id)).val, 21.5);

                const humidity = await harness.objects.getObjectAsync('webhook.0.garten.sensor.data.humidity');
                assert.deepStrictEqual(
                    [humidity.common.role, humidity.common.unit, humidity.common.min, humidity.common.max],
                    ['value.humidity', '%', 0, 100],
                );

                const door = await harness.objects.getObjectAsync('webhook.0.garten.sensor.data.door_open');
                assert.strictEqual(door.common.role, 'sensor.door');

                const nothing = await harness.objects.getObjectAsync('webhook.0.garten.sensor.data.nothing');
                assert.strictEqual(nothing.common.type, 'mixed');

                const level = await harness.states.getStateAsync('webhook.0.garten.sensor.data.level');
                assert.strictEqual(level.val, 3);

                const ip = await harness.objects.getObjectAsync('webhook.0.garten.sensor.meta.ip');
                assert.strictEqual(ip.common.role, 'info.ip');
            });
        });
    },
});
