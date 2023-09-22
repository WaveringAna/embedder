//import sqlite3 from "sqlite3";
import mkdirp from "mkdirp";
import crypto from "crypto";

import { Database } from "bun:sqlite";

mkdirp.sync("./uploads");
mkdirp.sync("./var/db");

export const db = new Database("./var/db/media.db");

/** 
 * Represents a generic row structure in a database table.
 */
export interface GenericRow {
  id? : number | string,
  username?: string
  expire? :Date
}

/** 
 * Represents a row structure in the media table.
 */
export interface MediaRow {
  id? : number | string,
  path: string,
  expire: Date,
  username?: string
}

/**
 * A tuple representing parameters for media-related operations.
 */
export type MediaParams = [
  path: string,
  expire: string | number | null,
  username?: string
]

/**
 * Represents a row structure in the user table.
 */
export interface UserRow {
  id? : number | string,
  username: string,
  hashed_password: any,
  salt: any,
  user_version? : number
}

/** 
 * Initializes the database tables and sets the user version pragma.
 * @param {number} version - The desired user version for the database.
 */
export function createDatabase(version: number){
  console.log("Creating database");

  db.run("CREATE TABLE IF NOT EXISTS users ( \
    id INTEGER PRIMARY KEY, \
    username TEXT UNIQUE, \
    hashed_password BLOB, \
    expire INTEGER, \
    salt BLOB \
  )")
  
  createUser("admin", process.env.EBPASS || "changeme");

  db.run("CREATE TABLE IF NOT EXISTS media ( \
    id INTEGER PRIMARY KEY, \
    path TEXT NOT NULL, \
    expire INTEGER, \
    username TEXT \
  )");

  db.run(`PRAGMA user_version = ${version}`);
}

/**
 * Updates the database schema from an old version to a new one.
 * @param {number} oldVersion - The current version of the database.
 * @param {number} newVersion - The desired version to upgrade to.
 */
export function updateDatabase(oldVersion: number, newVersion: number){
  if (oldVersion == 1) {
    console.log(`Updating database from ${oldVersion} to ${newVersion}`);
    db.run("PRAGMA user_version = 2");
    db.run("ALTER TABLE media ADD COLUMN username TEXT");
  
    db.run("ALTER TABLE users ADD COLUMN expire TEXT");
  }
}

/** 
 * Inserts a new media record into the media table.
 * @param {string} filename - The name of the file.
 * @param {string | number | null} expireDate - The expiration date for the media.
 * @param {string} username - The name of the user.
 */
export function insertToDB (filename: string, expireDate: string | number | null, username: string) {
  try {
    const params: MediaParams = [
      filename, 
      expireDate, 
      username
    ];

    const query = db.prepare("INSERT INTO media (path, expire, username) VALUES (?, ?, ?)");
    query.run(...params);

    console.log(`Inserted ${filename} to database`)
    if (expireDate == null)
      console.log("It will not expire");
    else if (expireDate != null || expireDate != undefined)
      console.log(`It will expire on ${expireDate}`);
  } catch (err) {
    console.log(err);
    throw err;
  }
}

/**
 * Searches for images in the database based on a name or keyword.
 * @param {string} imagename - The name or keyword to search for.
 * @param {boolean} partial - Whether to perform a partial search.
 */
export function searchImages(imagename: string, partial: boolean) {
  return new Promise((resolve, reject) => {
    console.log(`searching for ${imagename}`);
  });
}

/**
 * Updates the name of an image in the database.
 * @param {string} oldimagename - The current name of the image.
 * @param {string} newname - The new name for the image.
 */
export function updateImageName(oldimagename: string, newname:string) {
  return new Promise((resolve, reject) => {
    console.log(`updating ${oldimagename} to ${newname}`);
  });
}
/** 
 * Adds a new user to the users table in the database.
 * @param {string} username - The name of the user.
 * @param {string} password - The user's password.
 */
export function createUser(username: string, password: string) {
  return new Promise((resolve, reject) => {
    console.log(`Creating user ${username}`);
    const salt = crypto.randomBytes(16);
  
    db.run("INSERT OR IGNORE INTO users (username, hashed_password, salt) VALUES (?, ?, ?)", [
      username,
      crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256"),
      salt
    ]);

    resolve(null);
  });
}

/**
 * Retrieves the path for a file from the media table based on the given ID.
 *
 * @param {number|string} id - The ID of the record whose path needs to be fetched.
 * @returns {Promise<any[]>} A promise that resolves with the selected paths.
 *                           The resolved value is an array of records (usually containing a single item).
 * @throws Will reject the promise with an error if the query fails.
 */
export function getPath(id: number | string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      const query = db.prepare("SELECT path FROM media WHERE id = ?");
      resolve(query.all(id));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes a row from a specified table based on its ID.
 * 
 * @param {string} database - The name of the database table.
 * @param {number | string} id - The ID of the row to delete.
 */
export function deleteId(database: string, id: number | string): void {
  const deleteQuery = `DELETE FROM ${database} WHERE id = ?`;
  db.prepare(deleteQuery).run(id);
}

/** 
 * Removes rows from a table that are older than a given expiration date.
 * 
 * @param {string} database - The name of the database table.
 * @param {string} column - The column name used for date comparison.
 * @param {number} expiration - The expiration date in UNIX time.
 * @returns {Promise<void>}
 */
export function expire(database: string, column: string, expiration:number) {
  return new Promise((resolve, reject) => {
    const rows: GenericRow[] = db.query(`SELECT * FROM ${database} WHERE ${column} < ?`).all(expiration);

    for (const row of rows) {
      deleteId(database, row.id);
    }
  });
}