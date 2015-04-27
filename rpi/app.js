

var Camelot = require('camelot');
var util = require('util');
var AWS = require('aws-sdk');
var moment = require('moment');
var _ = require('underscore');

var config = {
	bucket: '341-webcam',
	ttl_days: 7,
	folder: 'images',
	refresh: 5000
};

// DON'T FORGET TO SET AWS_ACCESS_KEY and AWS_SECRET_ACCESS_KEY

var camelot = new Camelot( {
  device:'/dev/video0',
  resolution:'800x600'
});


function getFile() {
	camelot.grab( {
	  'font' : 'Arial:24',
	  title: ""
	  //'frequency' : 5   
	});
}

var s3 = new AWS.S3({Bucket:config.bucket});

if (config.ttl_days) {

	var bucketParams = {
	  Bucket: config.bucket, 
	  LifecycleConfiguration: {
	    Rules: [ 
	      {
	        Prefix: config.folder, 
	        Status: 'Enabled', 
	        Expiration: {
	          Days: config.ttl_days
	        },
	        ID: 'TTL_7_Days'
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
	  }
	});

}

var refreshRate = config.refresh;
 
camelot.on('frame', function (image) {
  var sort = Number(0xFFFFFFFFFFFFFFF - Date.now()).toString(16);
  var start = Date.now();
  var key = sort + "__" + moment().format('YYYY-MM-DD-HH-mm-ss') + '.png'; 

  console.log(moment().toISOString() + ': Uploading frame of ' + image.length + ' bytes to ' + key);
  
  s3.upload({
  	Bucket:config.bucket,
    Key:  config.folder + '/' + key,
    Body: image,
    ContentType: 'image/png',
    Expires: moment().add(7, 'days').toDate(),
    ACL: 'public-read'
  },function (err, resp) {
  	var refresh = refreshRate;
  	if (err)  {
  		console.error("Error uploading to S3: " + err.message);
  		refresh *= 10;
  	}
  	else {
	    var ms = Date.now() - start;
	    console.log('Successfully uploaded file in ' + ms + 'ms');
	}
	_.delay(getFile, refresh);

  });
});

camelot.on('error', function (err) {
  console.log(err);
});

getFile();


