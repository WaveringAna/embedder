import sqlite3 from "sqlite3";
import mkdirp from "mkdirp";
import crypto from "crypto";

mkdirp.sync("./uploads");
mkdirp.sync("./var/db");

export const db = new sqlite3.Database("./var/db/media.db");

/**Create the database schema for the embedders app*/
export function createDatabase(version: number) {
  console.log("Creating database");

  db.run(
    "CREATE TABLE IF NOT EXISTS users ( \
    id INTEGER PRIMARY KEY, \
    username TEXT UNIQUE, \
    hashed_password BLOB, \
    expire INTEGER, \
    salt BLOB \
  )",
    () => createUser("admin", process.env.EBPASS || "changeme")
  );

  db.run(
    "CREATE TABLE IF NOT EXISTS media ( \
    id INTEGER PRIMARY KEY, \
    path TEXT NOT NULL, \
    expire INTEGER, \
    username TEXT \
  )"
  );

  db.run(
    "CREATE TABLE IF NOT EXISTS settings ( \
    id INTEGER PRIMARY KEY, \
    downsclaing BOOLEAN, \
    namerandomization BOOLEAN \
  )"
  );

  db.run(`PRAGMA user_version = ${version}`);
}

/**Updates old Database schema to new */
export function updateDatabase(oldVersion: number, newVersion: number) {
  if (oldVersion == 1) {
    console.log(`Updating database from ${oldVersion} to ${newVersion}`);
    db.run("PRAGMA user_version = 3", (err) => {
      if (err) return;
    });
    
    db.run("ALTER TABLE media ADD COLUMN username TEXT", (err) => {
      if (err) return;
    });

    db.run("ALTER TABLE users ADD COLUMN expire TEXT", (err) => {
      if (err) return;
    });
  }
  if (oldVersion == 2) {
    console.log(`Updating database from ${oldVersion} to ${newVersion}`);
    db.run("PRAGMA user_version = 3", (err) => {
      if (err) return;
    });

    db.run(
      "CREATE TABLE IF NOT EXISTS settings ( \
      id INTEGER PRIMARY KEY, \
      downsclaing BOOLEAN, \
      namerandomization BOOLEAN \
    )"
    );
  }
}

/**Inserts into the media table */
export function insertToDB(
  filename: string,
  expireDate: Date,
  username: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const params: MediaParams = [filename, expireDate, username];

    db.run(
      "INSERT INTO media (path, expire, username) VALUES (?, ?, ?)",
      params,
      function (err) {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          console.log(`Uploaded ${filename} to database`);
          if (expireDate == null) console.log("It will not expire");
          else if (expireDate != null || expireDate != undefined)
            console.log(`It will expire on ${expireDate}`);
          resolve();
        }
      }
    );
  });
}

/**Searches the database and returns images with partial or exact keysearches */
export function searchImages(imagename: string, partial: boolean) {
  return new Promise((resolve, reject) => {
    console.log(`searching for ${imagename}`);
  });
}

export function updateImageName(oldimagename: string, newname: string) {
  return new Promise((resolve, reject) => {
    console.log(`updating ${oldimagename} to ${newname}`);
  });
}

/**Inserts a new user to the database */
export function createUser(username: string, password: string) {
  return new Promise((resolve, reject) => {
    console.log(`Creating user ${username}`);
    const salt = crypto.randomBytes(16);

    db.run(
      "INSERT OR IGNORE INTO users (username, hashed_password, salt) VALUES (?, ?, ?)",
      [username, crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256"), salt]
    );

    resolve(null);
  });
}

/**Selects the path for a file given ID */
export function getPath(id: number | string) {
  return new Promise((resolve, reject) => {
    const query = "SELECT path FROM media WHERE id = ?";

    db.get(query, [id], (err: Error, path: object) => {
      if (err) {
        reject(err);
      }
      resolve(path);
    });
  });
}

/**Deletes from database given an ID */
export function deleteId(database: string, id: number | string) {
  return new Promise((resolve, reject) => {
    const query = `DELETE FROM ${database} WHERE id = ?`;

    db.run(query, [id], (err: Error) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(null);
    });
  });
}

/**Expires a database row given a Date in unix time */
export function expire(database: string, column: string, expiration: number) {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM ${database} WHERE ${column} < ?`;

    db.each(query, [expiration], async (err: Error, row: GenericRow) => {
      if (err) reject(err);
      await deleteId(database, row.id);

      resolve(null);
    });
  });
}

/**A generic database row */
export interface GenericRow {
  id?: number | string;
  username?: string;
  expire?: Date;
}

/**A row for the media database */
export interface MediaRow {
  id?: number | string;
  path: string;
  expire: Date;
  username?: string;
}

/**Params type for doing work with media database */
export type MediaParams = [path: string, expire: Date, username?: string];

/**A row for the user database */
export interface UserRow {
  id?: number | string;
  username: string;
  hashed_password: any;
  salt: any;
}
