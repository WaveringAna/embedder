# Embedder 🖼️

A media host specialized in producing visually appealing embeds for services like Discord. Enjoy limitless file sizes and no compression.

![Embedder Demo](documentation/readmegif.gif)

## 🚀 Upcoming Features

- 📊 MariaDB/SQL support (currently uses SQLite)
- 🔗 Redundancy & Sync: Enhance reliability and enable synchronization across nodes.

## 🌐 Potential Features

- 🛰️ IPFS Integration

## 🔧 How to Run

### Using Source

```bash
$ export EBPASS=changeme
$ export EBPORT=3000
$ export EBAPI_KEY=changeme # For ShareX support

$ npm install
$ npm start
```

**Note**: Default username is `admin` with the password being whatever `EBPASS` is set to.

### ShareX Support

Enabled at `/upload`. Requires authentication with key. `expire` key specifies duration in days.

```json
{
  "Version": "14.1.0",
  "Name": "embedder",
  "DestinationType": "ImageUploader, FileUploader",
  "RequestMethod": "POST",
  "RequestURL": "http://localhost:3000/sharex",
  "Headers": {
    "key": "changeme"
  },
  "Body": "MultipartFormData",
  "Arguments": {
    "fileupload": null,
    "expire": null
  },
  "FileFormName": "fileupload",
  "URL": null,
  "ThumbnailURL": null,
  "DeletionURL": null,
  "ErrorMessage": null
}
```

### Configuration

This project uses environmental variables to configure functions.

`EBPASS` configures the password for the admin account.

`EBAPI_KEY` configures the key for API uploading support typically used for ShareX.

`EBPORT` configures the port the server runs on.

`EB_FFMPEG_PATH` and `EB_FFPROBE_PATH` configures the path to the ffmpeg and ffprobe binaries respectively. If not set, it uses installed binaries set in the PATH. If none are detected, it will default to preinstalled binaries from the [node-ffmpeg-installer](https://www.npmjs.com/package/@ffmpeg-installer/ffmpeg) package.

`EB_RANDOMIZE_NAMES` configures whether or not to randomize file names. If set to `true`, file names will be randomized. If not set or set to false, it will be `false`.

### Using Docker

```bash
docker run -d -p "3000:3000" -e EBPORT=3000 -e EBPASS=changeme -e EBAPI_KEY=changeme ghcr.io/waveringana/embedder:1.10.4
```

### Docker Compose

```yaml
version: "3.3"
services:
  embedder:
    ports:
      - "3000:3000"
    environment:
      - EBPORT=3000
      - EBPASS=changeme
      - EBAPI_KEY=changeme
    volumes:
      - ./db:/var/db
      - ./uploads:/uploads
    image: ghcr.io/waveringana/embedder:1.10.4
```

## 📜 License

Distributed under [The Unlicense](https://opensource.org/licenses/unlicense).
