import sqlite3 from "sqlite3";
import mkdirp from "mkdirp";
import crypto from "crypto";

mkdirp.sync("./uploads");
mkdirp.sync("./var/db");

export const db = new sqlite3.Database("./var/db/media.db");

/**Inserts a new user to the database */
export function createUser(username: string, password: string) {
  let salt = crypto.randomBytes(16);

  db.run("INSERT OR IGNORE INTO users (username, hashed_password, salt) VALUES (?, ?, ?)", [
    username,
    crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256"),
    salt
  ]);
}

/**Selects a path for a file given ID */
export function getPath(id: number | string) {
  return new Promise((resolve, reject) => {
    let query: string = `SELECT path FROM media WHERE id = ?`;

    db.get(query, [id], (err: Error, path: object) => {
      if (err) {reject(err)}
      resolve(path)
    });
  })
}

/**Deletes from database given an ID */
export function deleteId(database: string, id: number | string) {
  return new Promise((resolve, reject) => {
    let query: string = `DELETE FROM ${database} WHERE id = ?`

    db.run(query, [id], (err: Error) => {
      if (err) {reject(err); return;}
      resolve(null)
    })
  })
}

/**Expires a database row given a Date in unix time */
export function expire(database: string, column: string, expiration:number) {
  return new Promise((resolve, reject) => {
    let query: string = `SELECT * FROM ${database} WHERE ${column} < ?`;

    db.each(query, [expiration], async (err: Error, row: GenericRow) => {
      await deleteId(database, row.id)

      resolve(null);
    });
  })
}

/**A generic database row */
export interface GenericRow {
  id? : number | string,
  username?: string
  expire? :Date
}

/**A row for the media database */
export interface MediaRow {
  id? : number | string,
  path: string,
  expire: Date,
  username?: string
}

/**Params type for doing work with media database */
export type MediaParams = [
  path: string,
  expire: Date,
  username?: string
]

/**A row for the user database */
export interface UserRow {
  id? : Number,
  username: string,
  hashed_password: any,
  salt: any
}