# Express Middleware Documentation for Embedder

Embedder employs a series of middleware functions to facilitate operations such as user authentication, media conversions, and handling uploaded files.

## Middleware Functions

---

### `checkAuth()`
- **Description**: Ensures the user is authenticated.
- **Parameters**:
  - `req`: Express request object
  - `res`: Express response object
  - `next`: Callback to the next middleware function

---

### `checkSharexAuth()`
- **Description**: Validates the ShareX authentication key provided in the headers.
- **Parameters**:
  - `req`: Express request object
  - `res`: Express response object
  - `next`: Callback to the next middleware function

---

### `createEmbedData()`
- **Description**: Generates oEmbed metadata for embeds and saves them as JSON files.
- **Parameters**:
  - `req`: Express request object
  - `res`: Express response object
  - `next`: Callback to the next middleware function

---

### `convert()`
- **Description**: Converts media files between video and GIF formats using ffmpeg.
- **Parameters**:
  - `req`: Express request object
  - `res`: Express response object
  - `next`: Callback to the next middleware function

---

### `convertTo720p()`
- **Description**: Converts the uploaded video to a 720p resolution to reduce file size.
- **Parameters**:
  - `req`: Express request object
  - `res`: Express response object
  - `next`: Callback to the next middleware function

---

### `handleUpload()`
- **Description**: Manages the uploaded files and records their metadata into the database.
- **Parameters**:
  - `req`: Express request object
  - `res`: Express response object
  - `next`: Callback to the next middleware function

