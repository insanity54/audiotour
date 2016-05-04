/**
 * downloads files from plivo's s3 to local 
 */
var request = require('superagent');
var fs = require('fs');
var url = require('url');
var path = require('path');


var Downloader = function Downloader(nconf) {
    this.directory = path.join(__dirname, 'audio');
    this.nconf = nconf;
};

Downloader.prototype.download = function download(downloadUrl, toPath, cb) {
    var self = this;
    
    if (typeof downloadUrl !== 'string') throw new Error('downloadUrl is not a string');
    if (typeof toPath !== 'string') throw new Error('download toPath was not a string');
    // cb is optional
    
    var p;
    if (typeof toPath === 'number') {
        p = path.join(self.directory, toPath, '.mp3');
    }
    else {
        if (path.isAbsolute(toPath)) p = toPath ;
        else throw new Error('path is not absolute');
    }
    
    var stream = fs.createWriteStream(p);
    var req = request.get(downloadUrl);
    req.pipe(stream);
    
    if (typeof cb === 'function') return cb(null, p);
    return self;
};
 
 
module.exports = Downloader;