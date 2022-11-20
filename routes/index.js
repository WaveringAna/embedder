let multer = require("multer");
let express = require("express");
let ffmpeg = require("fluent-ffmpeg");
let imageProbe = require("probe-image-size");
let ffmpegpath = require("@ffmpeg-installer/ffmpeg").path;
let ffprobepath = require("@ffprobe-installer/ffprobe").path;

ffmpeg.setFfmpegPath(ffmpegpath);
ffmpeg.setFfprobePath(ffprobepath);

let fs = require("fs");

let db = require("../db");
let {checkAuth, convert, handleUpload} = require("../middleware");

function extension(str){
	let file = str.split("/").pop();
	return [file.substr(0,file.lastIndexOf(".")),file.substr(file.lastIndexOf("."),file.length).toLowerCase()];
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "uploads/");
	},
	filename : function(req, file, cb) {
		let nameAndExtension = extension(file.originalname);
		db.all("SELECT * FROM media WHERE path = ?", [nameAndExtension[0] + nameAndExtension[1]], function (err, exists) {
			if (exists.length != 0) {
				let suffix = new Date().getTime() / 1000;

				if (req.body.title == "" || req.body.title  == null || req.body.title == undefined)
					cb(null, nameAndExtension[0] + "-" + suffix + nameAndExtension[1]);
				else
					cb(null, req.body.title + "-" + suffix + nameAndExtension[1]);
			} else {
				if (req.body.title == "" || req.body.title  == null || req.body.title == undefined)
					cb(null, nameAndExtension[0] + nameAndExtension[1]);
				else
					cb(null, req.body.title + nameAndExtension[1]);
			}
		});
	}
});

/**let allowedMimeTypes = [
	"image/png",
	"image/jpg",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"video/mp4",
	"video/mov",
	"video/webm",
	"audio/mpeg",
	"audio/ogg"
];

const fileFilter = function(req, file, cb) {
	if (allowedMimeTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(null, false);
	}
};**/

let upload = multer({ storage: storage /**, fileFilter: fileFilter**/ }); //maybe make this a env variable?

function fetchMedia(req, res, next) {
	db.all("SELECT * FROM media", (err, rows) => {
		if (err) return next(err);
		let files = rows.map((row)=> {
			return {
				id: row.id,
				path: row.path,
				expire: row.expire,
				url: "/" + row.id
			};
		});
		res.locals.files = files.reverse(); //reverse so newest files appear first
		res.locals.Count = files.length;
		next();
	});
}

let router = express.Router();

router.get("/", function (req, res, next) {
	if (!req.user) { return res.render("home"); }
	next();
}, fetchMedia, function(req, res) {
	res.locals.filter = null;
	res.render("index", { user: req.user });
});

router.get("/gifv/:file", async function (req, res, next) {
	let url = `${req.protocol}://${req.get("host")}/uploads/${req.params.file}`;
	let width; let height;

	let nameAndExtension = extension("uploads/" + req.params.file);
	if (nameAndExtension[1] == ".mp4") {
		ffmpeg()
			.input("uploads/" + req.params.file)
			.inputFormat("mp4")
			.ffprobe(function(err, data) {
				if (err) return next(err);
				width = data.streams[0].width;
				height = data.streams[0].height;
				return res.render("gifv", { url: url, host: `${req.protocol}://${req.get("host")}`, width: width, height: height });
			}); 
	} else if (nameAndExtension[1] == ".gif") {
		ffmpeg()
			.input("uploads/" + req.params.file)
			.inputFormat("gif")
			.ffprobe(function(err, data) {
				if (err) return next(err);
				width = data.streams[0].width;
				height = data.streams[0].height;
				return res.render("gifv", { url: url, host: `${req.protocol}://${req.get("host")}`, width: width, height: height });
			});
	} else {
		let imageData = await imageProbe(fs.createReadStream("uploads/" + req.params.file));
		return res.render("gifv", { url: url, host: `${req.protocol}://${req.get("host")}`, width: imageData.width, height: imageData.height });
	} 
});

router.post("/", [upload.array("fileupload"), convert, handleUpload], function(req, res) {
	return res.redirect("/");
});

router.post("/sharex", [checkAuth, upload.array("fileupload"), convert, handleUpload], function(req, res) {
	return res.send(`${req.protocol}://${req.get("host")}/uploads/${req.files[0].filename}`);
});

router.post("/:id(\\d+)/delete", function(req, res, next) {
	db.all("SELECT path FROM media WHERE id = ?", [ req.params.id ], function(err, path) {
		if (err) { return next(err); }
		fs.unlink(`uploads/${path[0].path}`, (err => {
			if (err) {
				console.log(err);
				if (err.errno == -4058) { //File just doesnt exist anymore
					db.run("DELETE FROM media WHERE id = ?", [
						req.params.id
					], function(err) {
						if (err) { return next(err); }
						return res.redirect("/");
					});
				} else {
					console.log(err);
					return res.redirect("/");
				}
			} else {
				console.log(`Deleted ${path}`);
				//Callback Hell :D
				db.run("DELETE FROM media WHERE id = ?", [
					req.params.id
				], function(err) {
					if (err) { return next(err); }
					return res.redirect("/");
				});
			}
		}));
	});
});

module.exports = router;
