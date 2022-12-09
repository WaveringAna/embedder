import sqlite3 from "sqlite3";
import mkdirp from "mkdirp";
import crypto from "crypto";
import { FileFilterCallback } from "multer";

mkdirp.sync("./uploads");
mkdirp.sync("./var/db");

export const db = new sqlite3.Database("./var/db/media.db");

export function createUser(username: string, password: string) {
	var salt = crypto.randomBytes(16);
	db.run("INSERT OR IGNORE INTO users (username, hashed_password, salt) VALUES (?, ?, ?)", [
		username,
		crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256"),
		salt
	]);
}

export function getPath(id: number | string) {
	return new Promise((resolve, reject) => {
		let query: string = `SELECT path FROM media WHERE id = ?`;
		db.get(query, [id], (err: Error, path: object) => {
			if (err) {reject(err)}
			resolve(path)
		});
	})
}

export function deleteId(database: string, id: number | string) {
	return new Promise((resolve, reject) => {
		let query: string = `DELETE FROM ${database} WHERE id = ?`
		db.run(query, [id], (err: Error) => {
			if (err) {reject(err); return;}
			resolve(null)
		})
	})
}

export interface MediaRow {
	id? : Number,
	path: String,
	expire: Date,
	username?: String
}

export type MediaParams = [
	path: String,
	expire: Date,
	username?: String
]

export interface UserRow {
	id? : Number,
	username: String,
	hashed_password: any,
	salt: any
}