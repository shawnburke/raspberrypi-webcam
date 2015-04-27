# raspberrypi-webcam
Take a Raspberry Pi, and old USB webcam, and some node.js and create a webcam security system complete with monitoring site using AWS S3.  The camera will take pictures at regular intervals and post them to S3, where a webpage will also be hosted.  With this web page you'll be able to view the pictures in near-realtime, at very low cost.

# What you need

1. A Raspberry Pi with node.js installed.  Follow [these instructions] to get Node.js installed properly on your RPi.  The RPi needs a network connection.
2. A USB webcamera.  I found an old unused one in a box.
3. An AWS account

# How it works

The plan is pretty simple!  We'll write a Node app on the RPi to grab picture frames periodically from the camera, then we'll upload them to S3.

On S3 we'll have a bucket configured as a [http://docs.aws.amazon.com/AmazonS3/latest/dev/WebsiteHosting.html](static website) so we can hit it with a web browser.  We'll store the images in this bucket, along with a simple web page that contains client-side JS for accessing the files.  
