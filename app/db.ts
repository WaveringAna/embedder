import type {RequestHandler as Middleware} from 'express';

const sqlite3 = require("sqlite3");
const mkdirp = require("mkdirp");
const crypto = require("crypto");

mkdirp.sync("./uploads");
mkdirp.sync("./var/db");

let db = new sqlite3.Database("./var/db/media.db");

export function createUser(username: string, password: string) {
	var salt = crypto.randomBytes(16);
	db.run("INSERT OR IGNORE INTO users (username, hashed_password, salt) VALUES (?, ?, ?)", [
		username,
		crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256"),
		salt
	]);
}

export default db;
