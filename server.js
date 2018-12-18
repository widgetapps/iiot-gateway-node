'use strict';

require('./init')();

let config = require('./config'),
    mqtt = require('mqtt'),
    SerialPort = require('serialport'),
    xbee_api = require('xbee-api'),
    Parser = require('binary-parser').Parser,
    fs = require('fs'),
    cbor = require('cbor');

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

let C = xbee_api.constants;

let xbeeAPI = new xbee_api.XBeeAPI({
    api_mode: 1
});

let serialport = new SerialPort('/dev/ttymxc7', {
    baudRate: 9600
});

serialport.pipe(xbeeAPI.parser);
xbeeAPI.builder.pipe(serialport);

console.log('Started on IP ' + config.ip + '. NODE_ENV=' + process.env.NODE_ENV);

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
    //console.log('Data received: ' + data.toString());
    if (mqttConnected) {
        let hexString = data.toString();

        console.log('Got data: ' + hexString);

        if (hexString.length !== 14) return;

        const buffer = Buffer.from(hexString, 'hex');

        let parser = new Parser()
            .endianess('big')
            .uint16('stx')
            .uint8('sensor')
            .float('value');

        let packet = parser.parse(buffer);

        //sendPayload(packet.sensor, packet.value);
    }
});

function sendPayload(sensorType, value) {

    let sensor = '';
    let sensorId = '5bdc2e4020433a23474c302a';

    switch (sensorType) {
        case 1: //vib
            sensor = 'vibration';
            value = Math.round(value * config.multiplier);
            break;
        case 2: // humi
            sensor = 'humidity';
            value = Math.round(value);
            break;
        case 3: //temp
            sensor = 'temperature';
            value = Math.round(value);
            break;
        default:
            return;
    }

    // console.log('Sensor: ' + sensorType + ' Value: ' + value);
    let json = {
        date: new Date(),
        value: value
    };
    let payload = cbor.encode(json);

    // console.log('MQTT Payload: ' + payload);

    let prefix = '/';
    if (config.prefix !== '') {
        prefix += config.prefix + '/';
    }
    client.publish(prefix + 'v1/' + sensorId + '/' + sensor, payload);
}
