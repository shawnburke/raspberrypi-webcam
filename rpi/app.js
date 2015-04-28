

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
    { name: 'awscreds', type: String, alias: "c",  description: "AWS creds.  These can be set here as 'key|secret_key' or via env variables AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY."},
];

var cli = cliArgs(args);
var options = cli.parse(); 

if (options.help || !options.bucket || true) {
	var usage = cli.getUsage({
		header:"Raspberry Pi Webcam Usage",
		footer:"\r\n\r\n  See http://github.com/shawnburke/raspberrypi-webcam for more info."
	});
	console.log(usage);
	console.log(JSON.stringify(options,null, 2))
	return;
}

var awsKey = process.env.AWS_ACCESS_KEY;
var awsSecret = process.env.AWS_SECRET_ACCESS_KEY;

if (options.awscreds) {
	var parts = options.awscreds.split('|');
	if (parts.length != 2) {
		console.error("Expected AWS creds as 'key|secret'");
		return;
	}
	awsKey = parts[0];
	awsSecret = parts[1];
}

// DON'T FORGET TO SET AWS_ACCESS_KEY and AWS_SECRET_ACCESS_KEY

if (!awsKey || !awsSecret) {
	console.error("Please set AWS creds (env variables AWS_ACCESS_KEY/AWS_SECRET_ACCESS_KEY, or command line as -c 'key|secret_key')");
	return;
}

var camelot = new Camelot( {
  device: options.device,
  resolution: options.resolution
});


var s3 = new AWS.S3({Bucket:options.bucket});
var bucketConfigured = false;

// configure the bucket so images TTL.
function configureBucket(callback) {


	if (!bucketConfigured && config.ttl_days > 0) {

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
		  		console.log("Configured " + config.bucket + " to TTL images after " + config.ttl_days + " days.");
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

	async.series([

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
			console.error("Error: " + err.message);
		}
		callback && callback(err);
	});
}

// kick it off!
getFile();


