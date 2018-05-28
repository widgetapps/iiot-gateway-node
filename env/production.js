'use strict';

module.exports = {
    mqttoptions: {
        clientId: process.env.MQTT_ID ||'gateway',
        username: process.env.MQTT_USER ||'gateway',
        password: process.env.MQTT_PASSWORD || ''
    }
};
