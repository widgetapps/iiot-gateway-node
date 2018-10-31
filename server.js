'use strict';

require('./init')();

let config = require('./config'),
    util = require('./lib/util'),
    mqtt = require('mqtt'),
    SerialPort = require('serialport'),
    xbee_api = require('xbee-api'),
    Parser = require('binary-parser').Parser,
    hmac = require('./lib/hmac'),
    fs = require('fs');

let client;
let mqttConnected = false;

fs.readFile(config.configpath + 'config.json', 'utf8', (err, data) => {
    if (err){
        console.error(err);
    } else {
        let configObj = JSON.parse(data);
        config.mqtt = configObj.mqtt;
        config.multiplier = configObj.multiplier;
        config.mqttoptions.username = configObj.mqttlogin;
        config.mqttoptions.password = configObj.mqttpassword;
        client = mqtt.connect(config.mqtt, config.mqttoptions);

        client.on('error', function (error) {
            console.log('Error connecting to MQTT Server with username ' + config.mqttoptions.username + ' and password ' + config.mqttoptions.password + ' - ' + error);
            process.exit(1);
        });

        client.on('connect', function () {
            console.log('Connected to MQTT server.');
            mqttConnected = true;
        });
    }
});

let C = xbee_api.constants;

let xbeeAPI = new xbee_api.XBeeAPI({
    api_mode: 1
});

let serialport = new SerialPort('/dev/ttymxc7', {
    baudRate: 9600,
});

serialport.pipe(xbeeAPI.parser);
xbeeAPI.builder.pipe(serialport);

console.log('Started on IP ' + config.ip + '. NODE_ENV=' + process.env.NODE_ENV);

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
        let hexString = data.toString();

        if (hexString.length !== 14) return;

        const buffer = Buffer.from(hexString, 'hex');

        let parser = new Parser()
            .endianess('big')
            .uint16('stx')
            .uint8('sensor')
            .float('value');

        let packet = parser.parse(buffer);

        sendPayload(packet.sensor, packet.value);
    }
});

function sendPayload(sensorType, value) {

    let header = 'DEAD0003003C000000D80001';

    switch (sensorType) {
        case 1: //vib
            header += '0008';
            value = Math.round(value * config.multiplier);
            break;
        case 2: // humi
            header += '0009';
            value = Math.round(value);
            break;
        case 3: //temp
            header += '0002';
            value = Math.round(value);
            break;
        default:
            return;
    }

    // console.log('Sensor: ' + sensorType + ' Value: ' + value);

    let packet = header + checksum(Buffer.from(header, 'hex')) + generateData(value);
    let payload = Buffer.from(packet, 'hex');

    // console.log('MQTT Packet: ' + packet);

    client.publish('telemetry', payload);
}

function generateData(value) {
    let count = '0001';
    let timestamp = (Math.round(Date.now() / 1000)).toString(16);
    timestamp = util.pad('00000000', timestamp);
    //timestamp = ('00000000' + timestamp).slice(-8); // pad the front
    let min = value.toString(16);
    min = util.pad('0000', min);
    //min = ('0000' + min).slice(-4); // pad the front
    let max = min;
    let avg = min;
    let cur = min;

    // console.log('VALS: [' + min + ',' + max + ',' + avg + ',' + cur + ']');

    let packet = count + timestamp + min + max + avg + cur;
    // console.log('PACKET: ' + packet);
    packet += hmac.createHmac(Buffer.from(packet, 'hex'));

    return packet;
}

function checksum(buffer) {
    let parser = new Parser()
        .endianess('big')
        .array(
            'words', {
                type: 'uint16be',
                length: 7
            }
        );

    let words = parser.parse(buffer);

    // Check the checksum
    //var words = dataparser.checksum(message.slice(0, util.HEADER_LENGTH - 2));
    let checksum;
    words.words.forEach(function(value) {
        checksum ^= value;
    });

    return ('0000' + checksum.toString(16)).slice(-4);
}
