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
            sendPayload(json);
        }
    }
});

function sendPayload(json) {
    var packetTemp = 'DEAD0003003C0000000100010002' + checksum(Buffer.from('DEAD0003003C0000000100010002', 'hex')) + generateData(json.temp);
    var packetVibr = 'DEAD0003003C0000000100010008' + checksum(Buffer.from('DEAD0003003C0000000100010008', 'hex')) + generateData(json.vibration);

    var payloadTemp = Buffer.from(packetTemp, 'hex');
    var payloadVibr = Buffer.from(packetVibr, 'hex');

    console.log('PAYLOAD TEMO: ' + payloadTemp.toString('hex'));
    console.log('PAYLOAD VIBR: ' + payloadVibr.toString('hex'));

    client.publish('telemetry', payloadTemp);
    client.publish('telemetry', payloadVibr);
}

function generateData(value) {
    var count = '0001';
    var timestamp = (Math.round(Date.now() / 1000)).toString(16);
    timestamp = ('00000000' + timestamp).slice(-8); // pad the front
    var min = Math.round(Math.abs(value)).toString(16);
    min = ('0000' + min).slice(-4);
    var max = min;
    var avg = min;
    var cur = min;

    console.log('VALS: [' + min + ',' + max + ',' + avg + ',' + cur + ']');

    var packet = count + timestamp + min + max + avg + cur;
    console.log('PACKET: ' + packet);
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
