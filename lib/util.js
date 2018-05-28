'use strict';

var CODE_TOO_SHORT  = '01',
    CODE_DENIED     = '02',
    CODE_LENGTH     = '03',
    CODE_NO_DEVICE  = '04',
    CODE_DATABASE   = '05',
    CODE_BAD_HEADER = '06',
    CODE_BAD_TYPE   = '07',
    CODE_CHECKSUM   = '08',
    CODE_BAD_DATA   = '09',
    CODE_BAD_TOPIC  = '10',
    CODE_NO_ID      = '11';

exports.CODE_TOO_SHORT  = CODE_TOO_SHORT;
exports.CODE_DENIED     = CODE_DENIED;
exports.CODE_LENGTH     = CODE_LENGTH;
exports.CODE_NO_DEVICE  = CODE_NO_DEVICE;
exports.CODE_DATABASE   = CODE_DATABASE;
exports.CODE_BAD_HEADER = CODE_BAD_HEADER;
exports.CODE_BAD_TYPE   = CODE_BAD_TYPE;
exports.CODE_CHECKSUM   = CODE_CHECKSUM;
exports.CODE_BAD_DATA   = CODE_BAD_DATA;
exports.CODE_BAD_TOPIC  = CODE_BAD_TOPIC;
exports.CODE_NO_ID      = CODE_NO_ID;

exports.HEADER_LENGTH = 16;

exports.sendError = function (sock, code) {
    sock.write('ER' + code);
};

exports.pubError = function (client, code) {
    client.publish('device-debug', 'ER' + code, {qos: 2});
};

exports.pubDebug = function (client, message) {
    client.publish('device-debug', message, {qos: 2});
};

exports.pubResponse = function (client, serialNumber, message) {
    client.publish(serialNumber + '/response', message, {qos: 2})
};

exports.debugLog = function (message) {
    if (process.env.NODE_ENV != 'production') {
        console.log('DEBUG: ' + message);
    }
};

exports.pad = function (pad, str, padLeft) {
    if (typeof str === 'undefined')
        return pad;
    if (padLeft) {
        return (pad + str).slice(-pad.length);
    } else {
        return (str + pad).substring(0, pad.length);
    }
};
