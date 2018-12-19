'use strict';

require('./init')();

let config = require('./config'),
    mqtt = require('mqtt'),
    SerialPort = require('serialport'),
    Readline = require('@serialport/parser-readline'),
    Parser = require('binary-parser').Parser,
    fs = require('fs'),
    cbor = require('cbor'),
    md5 = require('md5');

let client;
let mqttConnected = false;

fs.readFile(config.configpath + 'config.json', 'utf8', (err, data) => {
    if (err){
        console.error(err);
    } else {
        let configObj = JSON.parse(data);
        config.mqtt = configObj.mqtt;
        config.prefix = configObj.prefix;
        config.multiplier = configObj.multiplier;
        config.mqttoptions.username = configObj.mqttlogin;
        config.mqttoptions.password = configObj.mqttpassword;
        client = mqtt.connect(config.mqtt, config.mqttoptions);

        client.on('error', function (error) {
            console.log('Error connecting to MQTT Server with username ' + config.mqttoptions.username + ' - ' + error);
            process.exit(1);
        });

        client.on('connect', function () {
            console.log('Connected to MQTT server.');
            mqttConnected = true;
        });
    }
});

let serialport = new SerialPort('/dev/ttymxc7', {
    baudRate: 9600
});

serialport.on('open', function() {
    console.log('Connected to XBee on serial port /dev/ttymxc7.');
});

// Open errors will be emitted as an error event
serialport.on('error', function(err) {
    console.log('Error: ', err.message);
    process.exit(1);
});

const serialParser = serialport.pipe(new Readline({ delimiter: '\n' }));

serialParser.on('data', function (data) {
    if (mqttConnected) {
        let hexString = data.toString();
        console.log('Got data:   ' + hexString);

        if  (hexString.substr(0,4) !== 'DEAD') {
            let beginning = hexString.substr(8, 12);
            let middle = hexString.substr(0, 8);
            let end = hexString.substr(20);
            hexString = beginning + middle + end;
            if (hexString.substr(0,4) !== 'DEAD') return;
        }

        //console.log('Fixed data: ' + hexString);

        if (hexString.length !== 36) return;

        const buffer = Buffer.from(hexString, 'hex');

        let parser = new Parser()
            .endianess('big')
            .uint16('stx')
            .float('serialNumber')
            .float('vibration')
            .float('humidity')
            .float('temperature');

        let packet = parser.parse(buffer);

        //console.log('Parsed: ' + JSON.stringify(packet));

        packet.serialNumber = Math.round(packet.serialNumber * 10) / 10;

        /*
        console.log('Serial number: ' + packet.serialNumber);
        console.log('Vibration: ' + packet.vibration);
        console.log('Humidity: ' + packet.humidity);
        console.log('Temperature: ' + packet.temperature);
        */

        sendPayload(packet);
    }
});

function sendPayload(packet) {

    let sensorId = md5(packet.serialNumber);
    let source = 'gateway';

    let json = {};
    let payload = {};

    json['vibration'] = {
        date: new Date(),
        value: packet.vibration * config.multiplier
    };
    json['humidity'] = {
        date: new Date(),
        value: packet.humidity
    };
    json['temperature'] = {
        date: new Date(),
        value: packet.temperature
    };

    console.log('Serial #: ' + packet.serialNumber);
    console.log('ID: ' + sensorId);
    console.log('v:' + JSON.stringify(json['vibration']));
    console.log('h:' + JSON.stringify(json['humidity']));
    console.log('t:' + JSON.stringify(json['temperature']));

    payload['vibration'] = cbor.encode(json['vibration']);
    payload['humidity'] = cbor.encode(json['humidity']);
    payload['temperature'] = cbor.encode(json['temperature']);
    console.log('v:' + payload['vibration']);
    console.log('h:' + payload['humidity']);
    console.log('t:' + payload['temperature']);

    // console.log('MQTT Payload: ' + payload);

    return;

    let prefix = '/';
    if (config.prefix !== '') {
        prefix += config.prefix + '/';
    }

    client.publish(prefix + sensorId + '/' + source + '/v1/vibration', payload['vibration']);
    client.publish(prefix + sensorId + '/' + source + '/v1/humidity', payload['humidity']);
    client.publish(prefix + sensorId + '/' + source + '/v1/temperature', payload['temperature']);
}
