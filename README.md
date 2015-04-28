# raspberrypi-webcam
Take a Raspberry Pi, and old USB webcam, and some node.js and create a webcam security system complete with monitoring site using AWS S3.  The camera will take pictures at regular intervals and post them to S3, where a webpage will also be hosted.  With this web page you'll be able to view the pictures in near-realtime, at very low cost.

# What you need

1. A Raspberry Pi with node.js installed.  Follow [these instructions] to get Node.js installed properly on your RPi.  The RPi needs a network connection.
2. A USB webcamera.  I found an old unused one in a box.
3. An AWS account

# How it works

The plan is pretty simple!  We'll write a Node app on the RPi to grab picture frames periodically from the camera, then we'll upload them to S3.

On S3 we'll have a bucket configured as a [http://docs.aws.amazon.com/AmazonS3/latest/dev/WebsiteHosting.html](static website) so we can hit it with a web browser.  We'll store the images in this bucket, along with a simple web page that contains client-side JS for accessing the files.  


## Configuring S3

To configure the S3 account, you'll want to set it as a public static website so web browsers (and AJAX calls) can access the files.  However, this does not allow listing the files.  Even though S3 will return the list of files from `listBucket`, I was unable to find a way to get the S3 SDK to make calls without credentials, or to just use the XML parser so I can call with AJAX and then parse the result to JSON (this is very doable).  So rather than fighting that battle, the next easiest thing is to just create an IAM user with the ability to read the files in the bucket.

### Configuring the bucket for static website access

1. Go to the S3 management portal
2. Select the bucket
3. In Properties, choose "Static Website Hosting"
4. Select "Enable Website Hosting" and enter `Index.html` as the index document name.

### Configuring the IAM user

We want a user that can access the directory for pulling a list of the files, and we ONLY want this user to be able to do this.  These keys will be technically visible on the internet so we need to make sure they are properly configured.

1. In the AWS portal, choose Services > IAM
2. Choose Groups > "New Group"
3. For policy, use the following, replacing `BUCKET_NAME` with your bucket name.

		{
		    "Version": "2012-10-17",
		    "Statement": [
		        {
		            "Effect": "Allow",
		            "Action": [
		                "s3:Get*",
		                "s3:List*"
		            ],
		            "Resource": "arn:aws:s3:::BUCKET_NAME/*"
		        }
		    ]
		}

4. Save the group, give it a name
5. Choose "Users" > New User
6. Create a user and copy the AccessKey/SecretKey
7. Go back to the group, choose users, and add the newly created user.

You can now use the copied keys for public, readonly access.  These keys will be in the HTML file, but they don't offer any more abilities than the static website configuration already offers.

## Setting It All Up.

### Setting up the Raspberry Pi

Here we'll set up the RPi using our read/write AWS keys so it can write files to the bucket.

1. Install fswebcam (usually `sudo apt-get install fswebcam`)
2. Clone this repo
3. `cd rpi`
4. `npm install`
5. `npm install forever -g`
6. `sudo forever start app.js -b BUCKET_NAME -c 'AWS_ACCESS_KEY|AWS_SECRET_ACCESS_KEY'` (that's the format, not an OR!)

### Setting up the web page

Create a json file called `config.json`, which will house the configuration for your project.  You will drop this file next do your Index.html.  These values are outside of the html file so we can check in the HTML wihout accidentally checking in keys, or for testing different configurations.

#### Create your configuration file

Here is a template for the file:


		{
			"title" : "My Webcam",
			"AWS_ACCESS_KEY": "MY AWS KEY", // IAM KEY FROM ABOVE
			"AWS_SECRET_ACCESS_KEY": "MY AWS SECRET KEY", // IAM SECRET KEY FROM ABOVE
			"bucket": "MyS3Bucket",
			"sites": [
			  { 
			    "name": "Garage",
			    "folder":"images",
			    "refresh": 5
			  }
			]
		}

1. Upload `web/index.html` and `web/config.json' into the root of your bucket.  Be sure to do Set Details > Set Permissions > "Make Everything Public" when you are uploading.
2. Navigate to the page with your web browser as the root of the bucket: `http://mybucket.s3-website-us-west-2.amazonaws.com`.
3. Profit!  (okay, not really.)


