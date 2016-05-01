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


//
// Globals
//
var port = process.env.PORT || 5000;


//
// Init
//
var app = express();
var red = redis.createClient();
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
app.all('/response/sip/ringing/', function(req, res) {
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
        timeout: 3,     // first digit must be received within 3s
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


app.all('/response/sip/hangup/', function(req, res) {
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
    console.log(req.params);
    var digits = req.params['Digits'];
    console.log('got digits: '+digits);
    
    var r = plivo.Response();
    r.addSpeak('communique '+digits);
    //r.addWait({length: 3});
    res.set({
        'Content-Type': 'text/xml'
    });
    
    // find if this is a pre-recorded communique by
    // querying the database
    red.GET('audiotour:digits:'+digits, function(err, reply) {
        if (err) {
            r.addSpeak('sector cordoned');
            return res.end(r.toXML());
        }
        
        // redirect to the record endpoint if there is no communique
        if (!reply) {
            r.addRedirect('');
            res.end(r.toXML());
        }
        
        // play the recorded communique
        else {
            r.addPlay(reply);
            res.end(r.toXML());
        }
    });
});



app.post('/response/sip/recording/', function(req, res) {
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