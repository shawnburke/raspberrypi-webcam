
var async = require('async');
var Camelot = require('camelot');
var util = require('util');
var AWS = require('aws-sdk');
var moment = require('moment');
var _ = require('underscore');
var cliArgs = require("command-line-args");

/* CLI options... */

var args = 
[
	{ name: "help", type: Boolean, description: "Print usage instructions" },
    { name: "bucket", type: String, defaultOption:true, alias: "b", description: "The S3 Bucket to write to (required), you must have write permissions to this bucket." },
    { name: "ttl", type: Number, value: 7, description: "The number of days to TTL files in the bucket (default: 7)" },
    { name: 'folder', type: String, alias: "f", value:'images', description: "The subfolder to write images to in the bucket (default: 'images')"},
    { name: 'interval', type: Number, alias: "i", value:30, description: "The period of time to wait between captures (default 30)"},
    { name: 'device', type: String, alias: "d", value:'/dev/video0',  description: "The device to connect to (default '/dev/video0')"},
    { name: 'resolution', type: String, alias: "r", value:'800x600',  description: "Resolution for images (default '800x600')"},
    { name: 'awscreds', type: String, alias: "c",  description: "AWS creds.  These can be set here as 'key|secret_key', 'profile_name', or via env variables AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY."},
];

var cli = cliArgs(args);
var options = cli.parse(); 

if (options.help || !options.bucket) {
	var usage = cli.getUsage({
		header:"Raspberry Pi Webcam Usage",
		footer:"\r\n\r\n  See http://github.com/shawnburke/raspberrypi-webcam for more info."
	});
	console.log(usage);
	return;
}

var credentials = null;
var awsKey = process.env.AWS_ACCESS_KEY;
var awsSecret = process.env.AWS_SECRET_ACCESS_KEY;

if (options.awscreds && options.awscreds.length) {
	var parts = options.awscreds.split('|');
	switch (parts.length) {
		case 1:
			credentials = new AWS.SharedIniFileCredentials({profile: options.awscreds});
			break;
		case 2:
			awsKey = parts[0];
        	awsSecret = parts[1];
			break;
		default:
			console.error("Expected AWS creds as 'key|secret'");
			return;
	}
}

// DON'T FORGET TO SET AWS_ACCESS_KEY and AWS_SECRET_ACCESS_KEY

if (!credentials && (!awsKey || !awsSecret)) {
	console.error("Please set AWS creds (env variables AWS_ACCESS_KEY/AWS_SECRET_ACCESS_KEY, or command line as -c 'key|secret_key').  Remember that running as sudo will get a different environment.");
	return;
}

var camelot = new Camelot( {
  device: options.device,
  resolution: options.resolution
});

if (!credentials) {
	AWS.config.update({accessKeyId: awsKey, secretAccessKey: awsSecret});
}
else {

	AWS.config.credentials = credentials;
}
var s3 = new AWS.S3({Bucket:options.bucket});
var bucketConfigured = false;


// configure the bucket so images TTL.
function configureBucket(callback) {


	if (!bucketConfigured && options.ttl > 0) {

		var bucketParams = {
		  Bucket: options.bucket, 
		  LifecycleConfiguration: {
		    Rules: [ 
		      {
		        Prefix: options.folder, 
		        Status: 'Enabled', 
		        Expiration: {
		          Days: options.ttl
		        },
		        ID: 'TTL_' + options.ttl + "_days"
		      }
		    ]
		  }
		};

		s3.putBucketLifecycle(bucketParams, function(err, data) {
		  if (err) {
		  		console.error("Error configuring bucket lifecycle: " + err.message, err.stack); 
		  }
		  else {
		  		console.log("Configured " + options.bucket + " to TTL images after " + options.ttl + " days.");
		  		bucketConfigured = true;

		  }
		  callback(err);
		});
	}
	else {
		callback();
	}
}

var interval = options.interval * 1000;

function getFile(callback) {

	async.waterfall([

		configureBucket,
		function getPicture(cb) {
			camelot.grab( {
			  'font' : 'Arial:24',
			  title: ""
			}, cb);
		},
		function uploadFile(image, cb) {
			// trick so the S3 bucket is sorted newest-> oldest.
			// we subtract 'now' from -1, so we get an increasing number,
			// then prepend to the file pattern.
			var now = Date.now();
			var sort = Number(0xFFFFFFFFFFFFFFF - now).toString(16);
			var start = now;
			var key = sort + "__" + moment().format('YYYY-MM-DD-HH-mm-ss') + '.png'; 

			console.log(moment().toISOString() + ': Uploading frame of ' + image.length + ' bytes to ' + key);

			s3.upload({
				Bucket:options.bucket,
				Key:  options.folder + '/' + key,
				Body: image,
				ContentType: 'image/png',
				ACL: 'public-read'
			},function (err, resp) {
				var refresh = interval;
				if (err)  {
					console.error("Error uploading to S3: " + err.message);
					refresh *= 10;
				}
				else {
				    var ms = Date.now() - start;
				    console.log('Successfully uploaded file in ' + ms + 'ms');
				}
				// set our timer to call back through
				//
				_.delay(getFile, refresh);
				cb(err);
			});
		}
	], function(err) {
		if (err) {
			console.error("Error: " + (err.message||err));
		}
		callback && callback(err);
	});
}

// kick it off!
getFile();


