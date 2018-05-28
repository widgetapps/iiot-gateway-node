'use strict';

var init = require('./init')(),
    config = require('./config'),
    util = require('./lib/util'),
    mqtt = require('mqtt'),
    SerialPort = require('serialport'),
    xbee_api = require('xbee-api');

var client  = mqtt.connect(config.mqtt, config.mqttoptions);
var mqttConnected = false;

var C = xbee_api.constants;

var xbeeAPI = new xbee_api.XBeeAPI({
    api_mode: 1
});

var serialport = new SerialPort('/dev/ttymxc7', {
    baudRate: 9600,
});

serialport.pipe(xbeeAPI.parser);
xbeeAPI.builder.pipe(serialport);

console.log('Started on IP ' + config.ip + '. NODE_ENV=' + process.env.NODE_ENV);

client.on('error', function (error) {
    console.log('Error connecting to MQTT Server with username ' + config.mqttoptions.username + ' and password ' + config.mqttoptions.password + ' - ' + error);
    process.exit(1);
});

client.on('connect', function () {
    console.log('Connected to MQTT server.');
    mqttConnected = true;
});

xbeeAPI.parser.on("data", function(frame) {
    if (mqttConnected) {
        console.log(">>", frame);
    }
});

serialport.on("open", function() {
    console.log('Connected to XBee on serial port /dev/ttymxc7.');
});

// Open errors will be emitted as an error event
serialport.on('error', function(err) {
    console.log('Error: ', err.message);
    process.exit(1);
});