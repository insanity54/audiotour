var assert = require('chai').assert;
var app = require('../index');
var request = require('supertest');
var redis = require('redis');
var red = redis.createClient();
var fs = require('fs');
var nconf = require('nconf');
var url = require('url');
var path = require('path');


nconf.file(path.join(__dirname, '..', '/config.json'));

var rootURL = nconf.get('APP_ROOT_URL');
assert.isString(rootURL);
 
var readyBlob = {
    Direction: 'inbound',
    RecordUrl: 'https://s3.amazonaws.com/recordings_2013/24631aea-10c6-11e6-9dc2-842b2b096c5d.mp3',
    From: '1111111111',
    CallerName: '+1111111111',
    RecordingID: '24631aea-10c6-11e6-9dc2-842b2b096c5d',
    RecordFile: 'https://s3.amazonaws.com/recordings_2013/24631aea-10c6-11e6-9dc2-842b2b096c5d.mp3',
    RecordingEndMs: '1111111111',
    BillRate: '0.0085',
    To: '1111111111',
    RecordingDurationMs: '12380',
    CallUUID: 'ed16c975-bc06-41ae-94ad-29a6396449fa',
    CallStatus: 'in-progress',
    Event: 'RecordStop',
    RecordingDuration: '12',
    RecordingStartMs: '1462235389044'
};


describe('REST api', function() {
    
    describe('root path', function() {
        it('should serve JSON', function(done) {
            request(app)
                .get('/')
                .expect(function(res) {
                    assert.isObject(res.body),
                    assert.equal(res.body.root, true);
                })
                .end(function(err, res) {
                    if (err) throw err;
                    done();
                });
        });
    });
    
    
    describe('call reception', function() {
        
        it('should be served by Express', function(done) {
            request(app)
                .post('/response/sip/ringing/')
                .expect('X-Powered-By', 'Express', done);
        });
        
        it('should return valid XML', function(done) {
            request(app)
                .post('/response/sip/ringing/')
                .set('Accept', 'text/xml')
                .expect('Content-Type', /xml/)
                .expect(function(res) {
                    assert.isDefined(res.text);
                    //console.log(res.text);
                })
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;
                    done();
                });
        });
        
        it('should not have [object Object] in the XML', function(done) {
            request(app)
                .post('/response/sip/ringing/')
                .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
                .expect(function(res) {
                    assert.isDefined(res.text);
                    assert.notMatch(res.text, /\[object Object\]/, 'got stringified js object. check your code.');
                })
                .end(function(err, res) {
                    if (err) throw err;
                    done();
                });
        });
    });
    
    
    describe('call hangup', function() {
        it('should return 200 status for a good request', function(done) {
            request(app)
                .post('/response/sip/hangup/')
                .send({
                    'CallUUID': readyBlob.CallUUID,
                    'Digits': 7777777
                })
                .expect(200, done);
        });
    });
    
    
    describe('call digits', function() {
        beforeEach(function(done) {
            red.del('audiotour:digits:7777777', function(err, reply) {
                if (err) throw err;
                red.del('audiotour:digits:7777777:callid', function(err, reply) {
                    if (err) throw err;
                    done();
                });
            });
        });
        
        
        it('should return 200 for a good request', function(done) {
            request(app)
                .post('/response/sip/digits/')
                .set('Content-Type', 'application/json')
                .send({
                    'CallUUID': readyBlob.CallUUID,
                    'Digits': 7777777
                })
                .expect(200, done);
        });
        
        it('should return 400 for an invalid CallUUID', function(done) {
            request(app)
                .post('/response/sip/digits/')
                .set('Content-Type', 'application/json')
                .send({
                    'CallUUID': 'abcdefg',
                    'Digits': 7777777
                })
                .expect(400, done);
        });
        
        it('should return 400 if not receiving Digits', function(done) {
            request(app)
                .post('/response/sip/digits/')
                .set('Content-Type', 'application/json')
                .send({
                    'CallUUID': readyBlob.CallUUID
                })
                .expect(400, done);
        });
        
        it('should return 400 if not receiving callUUID', function(done) {
            request(app)
                .post('/response/sip/digits/')
                .set('Content-Type', 'application/json')
                .send({
                    'Digits': 7777777
                })
                .expect(400, done);
        });
        
        it('should recognize digits sent to Digits parameter', function(done) {
            request(app)
                .post('/response/sip/digits/')
                .set('Content-Type', 'application/json')
                .send({
                    'CallUUID': readyBlob.CallUUID,
                    'Digits': 666666
                })
                .expect(function(res) {
                    assert.isDefined(res.text);
                    //console.log(res.text);
                    assert.match(res.text, /<Speak>.*666666<\/Speak>/);
                })
                .end(function(err, res) {
                    if (err) throw err;
                    done();
                });
        });
        
        it('should play when receiving old digits', function(done) {
            red.set('audiotour:digits:7777777', 'https://www.dropbox.com/s/zn94xnul7kc18tx/badhuman.mp3?dl=1', function(err, reply) {
                if (err) throw err;
                request(app)
                    .post('/response/sip/digits/')
                    .set('Content-Type', 'application/json')
                    .send({
                        'CallUUID': readyBlob.CallUUID,
                        'Digits': 7777777
                    })
                    .expect(function(res) {
                        assert.isDefined(res.text);
                        assert.notMatch(res.text, /<Record.*recording_ready\/.*\/>/);
                        assert.match(res.text, /<Play>https:\/\/www\.dropbox\.com\/s\/zn94xnul7kc18tx\/badhuman.mp3\?dl=1<\/Play>/);
                    })
                    .end(function(err, res) {
                        if (err) throw err;
                        done();
                    });
            });
        });
        
        it('should return XML that starts recording when receiving new digits', function(done) {
            request(app)
                .post('/response/sip/digits/')
                .set('Content-Type', 'application/json')
                .send({
                    'CallUUID': readyBlob.CallUUID,
                    'Digits': 7777777
                })
                .expect(function(res) {
                    assert.isDefined(res.text);
                    //console.log(res.text);
                    assert.match(res.text, /<Record.*recording_ready\/.*\/>/);
                })
                .end(function(err, res) {
                    if (err) throw err;
                    done();
                });
        });
        
        it('should save CallUUID and Digits to database when getting digits', function(done) {
            request(app)
                .post('/response/sip/digits/')
                .set('Content-Type', 'application/json')
                .send({
                    'CallUUID': readyBlob.CallUUID,
                    'Digits': 7777777
                })
                .expect(function(res) {
                    assert.isDefined(res.text);
                    //console.log(res.text);
                })
                .end(function(err, res) {
                    if (err) throw err;
                    
                    red.get('audiotour:callid:'+readyBlob.CallUUID, function(err, reply) {
                        assert.isNull(err);
                        assert.isDefined(reply);
                        assert.isNumber;
                        done();
                    });
                });
        });
    });
    
    
    
    describe('recording ready', function() {
        it('should accept POST and return 200', function(done) {
            request(app)
                .post('/response/sip/recording_ready/')
                .set('Content-Type', 'application/json')
                .send({
                    'CallUUID': readyBlob.CallUUID,
                    'Digits': 7777777
                })
                .expect(function(res) {
                    assert.isDefined(res.text);
                    //console.log(res.text);
                    //assert.match(res.text, /<Record.*recording\/.*\/>/);
                })
                .end(function(err, res) {
                    if (err) throw err;
                    done();
                });
        });
        
        
        
            
        it('should return OK and HTTP status code 200', function(done) {
            request(app)
                .post('/response/sip/recording_ready/')
                .set('Content-Type', 'application/json')
                .send(readyBlob)
                .expect(function(res) {
                    assert.isDefined(res.text);
                    assert.match(res.text, /OK/);
                })
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;
                    done();
                });
        });
        
        
        
        it('should cause [Digits].mp3 to exist on the server', function(done) {
            request(app)
                .post('/response/sip/recording_ready/')
                .set('Content-Type', 'application/json')
                .send(readyBlob)
                .expect(function(res) {
                    assert.isDefined(res.text);
                    assert.match(res.text, /OK/);
                })
                .expect(200)
                .end(function(err, res) {
                    if (err) throw err;
                    
                    // assert [Digits].mp3 is on the server
                    request(app)
                        .get('/audio/7777777.mp3')
                        .expect(200, done);
                });
        });
    });
    
    
    
});