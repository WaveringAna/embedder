const sqlite3 = require("sqlite3");
const mkdirp = require("mkdirp");
const crypto = require("crypto");

mkdirp.sync("./var/db");

let db = new sqlite3.Database("./var/db/media.db");

db.serialize(function() {
	// create the database schema for the todos app
	db.run("CREATE TABLE IF NOT EXISTS users ( \
    id INTEGER PRIMARY KEY, \
    username TEXT UNIQUE, \
    hashed_password BLOB, \
    salt BLOB \
  )");

	db.run("CREATE TABLE IF NOT EXISTS media ( \
    id INTEGER PRIMARY KEY, \
    path TEXT NOT NULL, \
    expire INTEGER \
  )");
  
	// create an initial user (username: alice, password: letmein)
	var salt = crypto.randomBytes(16);
	db.run("INSERT OR IGNORE INTO users (username, hashed_password, salt) VALUES (?, ?, ?)", [
		"admin",
		crypto.pbkdf2Sync(process.env.EBPASS || "changeme", salt, 310000, 32, "sha256"),
		salt
	]);
});

module.exports = db;
