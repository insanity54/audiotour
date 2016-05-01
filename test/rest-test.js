var mocha = require('mocha');
var assert = require('chai').assert;
var app = require('../index');
var request = require('supertest');


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
        it('should return 200 status', function(done) {
            request(app)
                .post('/response/sip/hangup/')
                .expect(200, done);
        });
    });
    
    
    describe('call digits', function() {
        it('should return 200 status', function(done) {
            request(app)
                .post('/response/sip/digits/')
                .expect(200, done);
        });
        
        it('should recognize digits sent to Digits parameter', function(done) {
            request(app)
                .post('/response/sip/digits/')
                .send({"Digits":"666"})
                .expect(function(res) {
                    assert.isDefined(res.text);
                    console.log(res.text);
                    assert.match(res.text, /<Speak>.*666<\/Speak>/);
                })
                .end(function(err, res) {
                    if (err) throw err;
                    done();
                });
        });
    });
});