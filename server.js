'use strict';

var init = require('./init')(),
    config = require('./config'),
    util = require('./lib/util'),
    mqtt = require('mqtt'),
    SerialPort = require('serialport'),
    xbee_api = require('xbee-api'),
    Parser = require('binary-parser').Parser,
    hmac = require('./lib/hmac');

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
        // console.log(">>", frame);
    }
});

xbeeAPI.on('frame_object', function(frame) {
    // console.log('Frame OBJ> '+ frame);
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
        var hexString = data.toString();

        if (hexString.length !== 14) return;

        const buffer = Buffer.from(hexString, 'hex');

        var parser = new Parser()
            .endianess('big')
            .uint16('stx')
            .uint8('sensor')
            .float('value');

        var packet = parser.parse(buffer);

        sendPayload(packet.sensor, packet.value);
    }
});

function sendPayload(sensorType, value) {

    var header = 'DEAD0003003C000000D80001';

    switch (sensorType) {
        case 1: //vib
            header += '0008';
            value = Math.round(value * 100);
            break;
        case 2: // humi
            header += '0009';
            value = Math.round(value * 10) / 10;
            break;
        case 3: //temp
            header += '0002';
            value = Math.round(value * 10) / 10;
            break;
        default:
            return;
    }

    console.log('Sensor: ' + sensorType + ' Value: ' + value);

    var packet = header + checksum(Buffer.from(header, 'hex')) + generateData(value);
    var payload = Buffer.from(packet, 'hex');

    console.log('MQTT Packet: ' + packet);

    //client.publish('telemetry', payload);
}

function generateData(value) {
    var count = '0001';
    var timestamp = (Math.round(Date.now() / 1000)).toString(16);
    timestamp = ('00000000' + timestamp).slice(-8); // pad the front
    var min = value.toString(16);
    min = ('00000000' + min).slice(-8); // pad the front
    var max = min;
    var avg = min;
    var cur = min;

    // console.log('VALS: [' + min + ',' + max + ',' + avg + ',' + cur + ']');

    var packet = count + timestamp + min + max + avg + cur;
    // console.log('PACKET: ' + packet);
    packet += hmac.createHmac(Buffer.from(packet, 'hex'));

    return packet;
}

function checksum(buffer) {
    var parser = new Parser()
        .endianess('big')
        .array(
            'words', {
                type: 'uint16be',
                length: 7
            }
        );

    var words = parser.parse(buffer);

    // Check the checksum
    //var words = dataparser.checksum(message.slice(0, util.HEADER_LENGTH - 2));
    var checksum;
    words.words.forEach(function(value) {
        checksum ^= value;
    });

    return ('0000' + checksum.toString(16)).slice(-4);
}
