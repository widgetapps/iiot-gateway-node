'use strict';

module.exports = {
    app: {
        title: 'gateway-node',
        description: 'Node.js gateway device aggregator & MQTT client.',
        keywords: 'Node.js, MQTT'
    },
    ip: process.env.IP || '127.0.0.1',
    configpath: process.env.CONFIG_PATH || './',
    mqtt: process.env.MQTT || 'mqtt://mqtt.terepac.one'
};