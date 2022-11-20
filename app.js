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

// error handler
app.use((err, req, res) => {
	console.error(err.stack);
	res.status(500).send("Something broke!");
});

function prune () {
	console.log("Vacuuming database...");
	db.run("VACUUM");

	db.all("SELECT * FROM media WHERE expire > ?", [Date.now()], (err, rows) => {
		console.log("Expired rows: " + rows);
		if (err) return console.error(err);
		rows.forEach((row) => {
			console.log(`Deleting ${row.path}`);
			fs.unlink(`uploads/${row.path}`, (err) => {
				if (err) {
					if(err.errno == -4058) return; //file doesn't exist
					return console.error(err);
				}
				console.log(`Deleted ${row.path}`);
			});
			db.run("DELETE FROM media WHERE expire > ?", [Date.now()], (err) => {
				if (err) return console.error(err);
				console.log(`Deleted ${row.path} from database`);
			});
		});
	});
}

setInterval(prune, 1000 * 60 * 30); //prune every 30 minutes

module.exports = app;
