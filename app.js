require("dotenv").config();


let express = require("express");
let passport = require("passport");
let session = require("express-session");
let cookieParser = require("cookie-parser");
let SQLiteStore = require("connect-sqlite3")(session);

let fs = require("fs");
let path = require("path");

let authRouter = require("./routes/auth");
let indexRouter = require("./routes/index");

let db = require("./db");

let app = express();
app.enable("trust proxy");

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({
	extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(express.static(path.join(__dirname, "public")));
app.use(session({
	secret: process.env.EBSECRET || "pleasechangeme",
	resave: false,
	saveUninitialized: false,
	store: new SQLiteStore({
		db: "sessions.db",
		dir: "./var/db"
	})
}));
app.use(passport.authenticate("session"));

app.use("/", indexRouter);
app.use("/", authRouter);

app.use("/uploads", express.static("uploads"));

function prune () {
	console.log("Vacuuming database...");
	db.run("VACUUM");

	db.all("SELECT * FROM media WHERE expire < ?", [Date.now()], (err, rows) => {
		console.log("Expired rows: " + rows);
		if (err) return console.error(err);
		rows.forEach((row) => {
			console.log(`Deleting ${row.path}`);
			fs.unlink(`uploads/${row.path}`, (err) => {
				if (err) {
					if(err.errno == -4058) {
						console.log("File already deleted");
						db.all("DELETE FROM media WHERE path = ?", [row.path], (err) => {
							if (err) return console.error(err);
						});
					} else {
						console.error(err);
					}
				} else {
					db.all("DELETE FROM media WHERE path = ?", [row.path], (err) => {
						if (err) return console.error(err);
					});
				}
				
			});
			console.log(`Deleted ${row.path}`);
		});
	});
}

setInterval(prune, 1000 * 60 * 30); //prune every 30 minutes

module.exports = app;
