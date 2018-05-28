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

xbeeAPI.parser.on('data', function(frame) {
    if (mqttConnected) {
        console.log(">>", frame);
    }
});

xbeeAPI.on('frame_object', function(frame) {
    console.log('Frame OBJ> '+ frame);
});

serialport.on('open', function() {
    console.log('Connected to XBee on serial port /dev/ttymxc7.');
});

// Open errors will be emitted as an error event
serialport.on('error', function(err) {
    console.log('Error: ', err.message);
    process.exit(1);
});

serialport.on('data', function (data) {
    if (mqttConnected) {
        var values = data.toString().split(':');
        // H:28.42IT:34.44X:-0.0050Y:-1.0589Z:-0.0821ET:-6.04VRMS:1.0620
        if (values.length === 8) {
            var json = {
                humidity: values[1].replace('IT', ''),
                itemp: values[2].replace('X', ''),
                accelx: values[3].replace('Y', ''),
                accely: values[4].replace('Z', ''),
                accelz: values[5].replace('ET', ''),
                temp: values[6].replace('VRMS', ''),
                vibration: values[7]
            };
            console.log(JSON.stringify(json));
        }
    }
});