const ffmpeg = require("fluent-ffmpeg");
const ffmpegpath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobepath = require("@ffprobe-installer/ffprobe").path;
ffmpeg.setFfmpegPath(ffmpegpath);
ffmpeg.setFfprobePath(ffprobepath);

const fs = require("fs");
const process = require("process");

let db = require("../db.js").db;

function extension(str){
	let file = str.split("/").pop();
	return [file.substr(0,file.lastIndexOf(".")),file.substr(file.lastIndexOf("."),file.length).toLowerCase()];
}

//Checks ShareX key
function checkAuth(req, res, next) {
	let auth = process.env.EBAPI_KEY || process.env.EBPASS || "pleaseSetAPI_KEY";
	let key = null;
  
	if (req.headers["key"]) {
		key = req.headers["key"];
	} else {
		return res.status(400).send("{success: false, message: \"No key provided\", fix: \"Provide a key\"}");
	}
  
	if (auth != key) {
		return res.status(401).send("{success: false, message: '\"'Invalid key\", fix: \"Provide a valid key\"}");
	}
  
	let shortKey = key.substr(0, 3) + "..."; 
	console.log("Authenicated user with key: " + shortKey);
  
	next();
}
  
//Converts mp4 to gif and vice versa with ffmpeg
function convert(req, res, next) {
	for (let file in req.files) {
		let nameAndExtension = extension(req.files[file].originalname);
		let oembed = {
			type: "video",
			version: "1.0",
			provider_name: "embedder",
			provider_url: "https://github.com/WaveringAna/embedder",
			cache_age: 86400,
			html: `<iframe src='${req.protocol}://${req.get("host")}/gifv/${nameAndExtension[0]}${nameAndExtension[1]}'></iframe>`,
			width: 640,
			height: 360
		};
  
		fs.writeFile(`uploads/oembed-${nameAndExtension[0]}${nameAndExtension[1]}.json`, JSON.stringify(oembed), function (err) {
			if (err) return next(err);
			console.log(`oembed file created ${nameAndExtension[0]}${nameAndExtension[1]}.json`);
		});
  
		/**if (nameAndExtension[1] == ".mp4") {
			console.log("Converting " + nameAndExtension[0] + nameAndExtension[1] + " to gif");
			console.log(nameAndExtension[0] + nameAndExtension[1]);
			ffmpeg()
				.input(`uploads/${nameAndExtension[0]}${nameAndExtension[1]}`)
				.inputFormat("mp4")
				.outputFormat("gif")
				.output(`uploads/${nameAndExtension[0]}.gif`)
				.on("end", function() {
					console.log("Conversion complete");
					console.log(`Uploaded to uploads/${nameAndExtension[0]}.gif`);
				})
				.on("error", (e) => console.log(e))
				.run();
		} else if (nameAndExtension[1] == ".gif") {
			console.log(`Converting ${nameAndExtension[0]}${nameAndExtension[1]} to mp4`);
			ffmpeg(`uploads/${nameAndExtension[0]}${nameAndExtension[1]}`)
				.inputFormat("gif")
				.outputFormat("mp4")
				.outputOptions([
					"-pix_fmt yuv420p",
					"-c:v libx264",
					"-movflags +faststart"
				])
				.noAudio()
				.output(`uploads/${nameAndExtension[0]}.mp4`)
				.on("end", function() {
					console.log("Conversion complete");
					console.log(`Uploaded to uploads/${nameAndExtension[0]}.mp4`);
				})
				.run();
		}**/
	}
  
	next();
}
  
function handleUpload(req, res, next) {
	if (!req.files || Object.keys(req.files).length === 0) {
		console.log("No files were uploaded");
		return res.status(400).send("No files were uploaded.");
	}
  
	for (let file in req.files) {
		let currentdate = Date.now();
		let expireDate;
		if (req.body.expire) {
			expireDate = new Date(currentdate + (req.body.expire * 24 * 60 * 60 * 1000));
			console.log(req.body.expire);
			console.log(expireDate);
		} else
			expireDate = null;
		db.run("INSERT INTO media (path, expire) VALUES (?, ?)", [req.files[file].filename, expireDate], function (err) {
			if (err) { 
				console.log(err);
				return next(err);
			}
			console.log(`Uploaded ${req.files[file].filename} to database`);
			if (expireDate == null)
				console.log("It will not expire");
			else if (expireDate != null || expireDate != undefined || expireDate != "")
				console.log(`It will expire on ${expireDate}`);
		});
	}

	next();
}

module.exports = {
	checkAuth: checkAuth,
	convert: convert,
	handleUpload: handleUpload
};