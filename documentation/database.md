# Database Documentation for Embedder

Embedder utilizes **SQLite3** to manage its user system and store metadata for uploaded files.

---

## Databases:

### `media.db`
- **Description**: Manages the user system and image metadata.
  
### `session.db`
- **Description**: Handles login session data to keep users logged in over time.

---

## Tables:

### Media Table

#### TypeScript Interface: `MediaRow`

- **Description**: Represents a row in the media table.
- **Fields**:
  - `id`: Optional number or string
  - `path`: String
  - `expire`: Date object
  - `username`: Optional string

#### SQL Structure

- `id`: INTEGER
- `path`: TEXT
- `expire`: INTEGER
- `username`: TEXT

---

### User Table

#### TypeScript Interface: `UserRow`

- **Description**: Represents a row in the user table.
- **Fields**:
  - `id`: Optional number
  - `username`: String
  - `hashed_password`: Any
  - `salt`: Any

#### SQL Structure

- `id`: INTEGER
- `username`: TEXT
- `hashed_password`: BLOB
- `expire`: INTEGER
- `salt`: BLOB

---

## Database Interactions (`types/db.ts`)

### `createDatabase(version: number)`

- **Description**: Initializes the database schema.
- **Parameters**:
  - `version`: Number indicating the version of the database schema.
  
### `createUser(username: string, password: string)`

- **Description**: Inserts a new user record into the user table.
- **Parameters**:
  - `username`: String representing the user's name.
  - `password`: String representing the user's password.

### `insertToDB(filename: string, expireDate: Date, username: string)`

- **Description**: Adds a new media record into the media table.
- **Parameters**:
  - `filename`: String representing the filename of the uploaded media.
  - `expireDate`: Date object indicating when the media should expire.
  - `username`: String representing the user's name.

### `getPath(id: number | string)`

- **Description**: Retrieves the path for a specific file using its ID.
- **Parameters**:
  - `id`: Number or string representing the file's ID.

### `deleteId(database: string, id: number | string)`

- **Description**: Removes a record from the database.
- **Parameters**:
  - `database`: String representing the name of the database.
  - `id`: Number or string representing the ID of the record to be removed.

### `expire(database: string, column: string, expiration: number)`

- **Description**: Sets an expiration date for a particular database row.
- **Parameters**:
  - `database`: String representing the name of the database.
  - `column`: String representing the name of the column in which the date should be set.
  - `expiration`: Number representing the Unix timestamp when the record should expire.

