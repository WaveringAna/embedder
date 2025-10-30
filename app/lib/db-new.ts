import Database from 'better-sqlite3';
import mkdirp from 'mkdirp';
import crypto from 'crypto';

mkdirp.sync('./uploads');
mkdirp.sync('./var/db');

// Create database connection (synchronous and faster)
export const db = new Database('./var/db/media.db');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

/**
 * Database Interfaces
 */
export interface MediaRow {
  id: number;
  path: string;
  expire: number | null;
  username: string;
}

export interface UserRow {
  id: number;
  username: string;
  hashed_password: Buffer;
  salt: Buffer;
  expire: number | null;
}

export interface SettingsRow {
  id: number;
  downscaling: boolean;
  namerandomization: boolean;
}

/**
 * Prepared Statements (reusable and faster)
 */
const statements = {
  // Media
  insertMedia: db.prepare('INSERT INTO media (path, expire, username) VALUES (?, ?, ?)'),
  getMediaById: db.prepare('SELECT * FROM media WHERE id = ?'),
  getAllMedia: db.prepare('SELECT * FROM media'),
  getMediaByUsername: db.prepare('SELECT * FROM media WHERE username = ?'),
  getMediaPath: db.prepare('SELECT path FROM media WHERE id = ?'),
  deleteMedia: db.prepare('DELETE FROM media WHERE id = ?'),
  getExpiredMedia: db.prepare('SELECT * FROM media WHERE expire < ?'),

  // Users
  insertUser: db.prepare('INSERT OR IGNORE INTO users (username, hashed_password, salt) VALUES (?, ?, ?)'),
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  getAllUsers: db.prepare('SELECT * FROM users'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
};

/**
 * Create database schema
 */
export function createDatabase(version: number): void {
  console.log('Creating database schema');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      hashed_password BLOB NOT NULL,
      expire INTEGER,
      salt BLOB NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL,
      expire INTEGER,
      username TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      downscaling BOOLEAN,
      namerandomization BOOLEAN
    )
  `);

  db.pragma(`user_version = ${version}`);

  // Create default admin user if not exists
  createUser('admin', process.env.EBPASS || 'changeme');
}

/**
 * Update database schema
 */
export function updateDatabase(oldVersion: number, newVersion: number): void {
  console.log(`Updating database from ${oldVersion} to ${newVersion}`);

  if (oldVersion === 1) {
    db.exec('ALTER TABLE media ADD COLUMN username TEXT');
    db.exec('ALTER TABLE users ADD COLUMN expire TEXT');
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY,
        downscaling BOOLEAN,
        namerandomization BOOLEAN
      )
    `);
  }

  if (oldVersion === 2) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY,
        downscaling BOOLEAN,
        namerandomization BOOLEAN
      )
    `);
  }

  db.pragma(`user_version = ${newVersion}`);
}

/**
 * Check database version
 */
export function checkVersion(): void {
  const result = db.pragma('user_version', { simple: true }) as number;

  if (result === 0) {
    // New database
    createDatabase(3);
  } else if (result !== 3) {
    // Needs update
    updateDatabase(result, 3);
  }
}

/**
 * Media Operations
 */
export function insertMedia(filename: string, expireDate: number | null, username: string): number {
  try {
    const result = statements.insertMedia.run(filename, expireDate, username);
    console.log(`Uploaded ${filename} to database (ID: ${result.lastInsertRowid})`);
    if (expireDate === null) {
      console.log('It will not expire');
    } else {
      console.log(`It will expire on ${new Date(expireDate)}`);
    }
    return result.lastInsertRowid as number;
  } catch (error) {
    console.error('Error inserting media:', error);
    throw error;
  }
}

export function getMediaById(id: number): MediaRow | undefined {
  return statements.getMediaById.get(id) as MediaRow | undefined;
}

export function getAllMedia(): MediaRow[] {
  return statements.getAllMedia.all() as MediaRow[];
}

export function getMediaByUsername(username: string): MediaRow[] {
  return statements.getMediaByUsername.all(username) as MediaRow[];
}

export function getMediaPath(id: number): { path: string } | undefined {
  return statements.getMediaPath.get(id) as { path: string } | undefined;
}

export function deleteMedia(id: number): void {
  statements.deleteMedia.run(id);
}

export function getExpiredMedia(timestamp: number): MediaRow[] {
  return statements.getExpiredMedia.all(timestamp) as MediaRow[];
}

/**
 * User Operations
 */
export function createUser(username: string, password: string): void {
  console.log(`Creating user ${username}`);
  const salt = crypto.randomBytes(16);
  const hashedPassword = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256');

  try {
    statements.insertUser.run(username, hashedPassword, salt);
  } catch (error) {
    // User already exists or other error
    console.log(`User ${username} already exists or error occurred`);
  }
}

export function getUserByUsername(username: string): UserRow | undefined {
  return statements.getUserByUsername.get(username) as UserRow | undefined;
}

export function getAllUsers(): UserRow[] {
  return statements.getAllUsers.all() as UserRow[];
}

export function deleteUser(id: number): void {
  statements.deleteUser.run(id);
}

/**
 * Generic delete (for backwards compatibility)
 */
export function deleteId(table: string, id: number): void {
  const stmt = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
  stmt.run(id);
}

/**
 * Expire old entries
 */
export function expireOldEntries(timestamp: number): void {
  const expiredMedia = getExpiredMedia(timestamp);
  expiredMedia.forEach((row) => {
    deleteMedia(row.id);
  });
}

/**
 * Initialize database on import
 */
checkVersion();

// Graceful shutdown
process.on('exit', () => {
  db.close();
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
