//
// Includes
//
var plivo = require('plivo-node');
var express = require('express');
var bodyParser = require('body-parser');
var nconf = require('nconf');
var path = require('path');
var redis = require('redis');
var url = require('url');
var Downloader = require('./downloader');


//
// Globals
//
var port = process.env.PORT || 5000;


//
// Init
//
var app = express();
var red = redis.createClient();
var downloader = new Downloader(nconf);
app.use(bodyParser.urlencoded({ extended: false })); // Required for parsing POST
app.use(bodyParser.json()); // parse application/json
nconf.file(path.join(__dirname, 'config.json'));
// plivo api not used since we arent making calls, we are only receiving
// var api = plivo.RestAPI({
//     authId: nconf.get('authId'),
//     authToken: nconf.get('plivoToken')
// });
var rootURL = nconf.get('APP_ROOT_URL');


//
// Script
//



/**
 * root dir for sanity checks
 */
app.get('/', function(req, res) {
    res.set({'Content-Type': 'application/json'});
    res.json({"root": true, "appname": "audiotour"});
});


/**
 * a call is received.
 * 
 *   - announce app name and ask for an ID number.
 *   - if user enters digits, forward user to new endpoint
 *   - hangup if no digits received
 * 
 */
app.post('/response/sip/ringing/', function(req, res) {
    //console.log(req.params);
    //var hangup = req.params['HangupCause'];
    //console.log('hangup: ' + hangup);
    var r = plivo.Response();
    
    // The digits pressed are send to this endpoint but because of
    // redirect: true, this endpoint is redirected to for further
    // processing and returning of XML instructions
    var digitOptions = {
        action: url.resolve(rootURL, '/response/sip/digits/'),
        redirect: "true",
        timeout: 5,     // first digit must be received within 3s
        digitTimeout: 2 // time between digits must not be greater than 2s
    };
    
    //r.addRecord(recordOptions);
    //r.addWait({length: "9"});
    var d = r.addGetDigits(digitOptions);
    d.addSpeak('enter your designator ID number');
    //d.addWait({length: "5"});
    r.addSpeak('end due to inaction');
    r.addHangup({"reason": "no designator ID number entered"});
    // var dial = r.addDial();
    // dial.addNumber('15099220951');
    //r.addWait({ length: "3" });

    // if (hangup) {
    //     res.end("SIP Route hangup callback");
    //     return;
    // }

    res.set({
        'Content-Type': 'text/xml'
    });
    res.end(r.toXML());

});


app.post('/response/sip/hangup/', function(req, res) {
  //console.log('hangup check');
  //console.log(req.query);
  var hangup = req.params['HangupCause'];
  var id = req.params['CallUUID'];
   
  if (hangup) {
      console.log("This call is done! call id: "+id+" HangupCause: "+hangup);
  }
  
  return res.status(200).send('THANKS FOR LETTING ME KNOW');
});


// app.all('/response/sip/route/', function(req, res) {
//     console.log(req.query);
//     console.log('routing! ');
//     var hangup = req.param['HangupCause'];
//     //var machine = req.param['Machine'];

//     //console.log('machine? ' + machine);
    
//     var r = plivo.Response();
    
//     var recordOptions = {
//         //recordSession: "true",
//         startOnDialAnswer: "true",
//         redirect: "false",
//         action: "https://mtw-patch-monitor-insanity54.c9.io/response/sip/recording/",
//         maxLength: "20"
//     };
    
//     var digitOptions = {
//         action: 'https://mtw-patch-monitor-insanity54.c9.io/response/sip/digits/',
//         redirect: "false"
//     };
    
//     //r.addHangup({reason: 'busy'});
//     //r.addGetDigits(digitOptions);
//     r.addSpeak('Checking mobiletalk gateway');
//     r.addRecord(recordOptions);
//     var dial = r.addDial();
//     dial.addNumber('15099220951');
//     dial.addGetDigits(digitOptions);

//     dial.addWait({length: "13"});
//     r.addSpeak('farts in the woods');
//     r.addHangup();

//     if (hangup) {
//         // res.end("SIP Route hangup callback");
//         // return;
//         console.log('hangup reason: ' + hangup);
//     }

//     res.set({
//         'Content-Type': 'text/xml'
//     });
//     res.end(r.toXML());
// });

app.post('/response/sip/digits/', function(req, res) {
    var digits = req.body['Digits'];
    var callUUID = req.body['CallUUID'];
    //console.log('got digits: '+digits);
    if (typeof digits === 'undefined') return res.status(400).json({'error': true, 'msg': 'yo, dem Digits be missing'});
    if (typeof callUUID === 'undefined') return res.status(400).json({'error': true, 'msg': 'yo, where da callUUID at?'});
    if (!/[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}/.test(callUUID)) return res.status(400).json({'error': true, 'msg': 'yo, that CallUUID is wack.'});

    var r = plivo.Response();
    r.addSpeak('communique '+digits);
    //r.addWait({length: 3});
    res.set({
        'Content-Type': 'text/xml'
    });
    
    // find if this is a pre-recorded communique by
    // querying the database
    red.GET('audiotour:digits:'+digits, function(err, reply) {
        //console.log('redis returned err=%s, reply=%s', err, reply);
        if (err) {
            r.addSpeak('sector cordoned');
            return res.end(r.toXML());
        }
        
        // record if there is no communique
        if (!reply) {
            //r.addRedirect(url.resolve(rootURL, '/response/sip/record/'));
            // log the callID with the digits
            
            red.set('audiotour:callid:'+callUUID, digits, function(err, reply) {
                if (err) throw err;
                r.addSpeak('You have 30 seconds to transmit your communique');
                var recordOpts = {
                    //action: url.resolve(rootURL, '/response/sip/record/'),
                    redirect: false,
                    method: 'POST',
                    fileFormat: 'mp3',
                    maxLength: 30,
                    playBeep: true,
                    callbackUrl: url.resolve(rootURL, '/response/sip/recording_ready/'),
                    callbackMethod: 'POST'
                };
                r.addRecord(recordOpts);
                r.addSpeak('connection terminate');
                return res.end(r.toXML());
            });
        
        }
        // if the digits are old
        // play the recorded communique
        else {
            r.addPlay(reply);
            return res.end(r.toXML());
        }
        
    });
});


/** a recording was just made, and plivo is telling us that it is ready to play*/
app.post('/response/sip/recording_ready/', function(req, res) {
    //console.log(req.body);
    //console.log(req.query);
    //console.log(req.params);
    res.status(200).send('OK');
});



app.post('/response/sip/record/', function(req, res) {
    //console.log('** recording result **');
     
    var r = plivo.Response();
    
    res.set({
        'Content-Type': 'text/xml'
    });
    return res.end(r.toXML());
});
    
app.post('/response/sip/recorded/', function(req, res) {
    console.log('** recording received **');
    var file = req.params['RecordUrl'];
    var id = req.params['RecordingID'];
    var time = req.params['RecordingStartMs'];
    
    if (file && id && time) {
        console.log('got recording. File: ' + file + ' id: ' + id + ' time: ' + time);
    } else {
        console.log('got some request at the url but didnt get the file id and time like expected.');
    }
    
    res.end();
});


app.listen(port);
console.log('Listening on port ' + port);


module.exports = app;