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
$ export EB_PROCESS_VIDEO=true # Enable video processing

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

This project uses environmental variables for configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `EBPASS` | Password for the admin account | required |
| `EBAPI_KEY` | Key for API uploading (ShareX) | required |
| `EBPORT` | Port the server runs on | required |
| `EB_PROCESS_VIDEO` | Enable video processing/optimization | `true` |
| `EB_ENCODER` | Video encoder to use (CPU, NVENC, QSV, etc.) | `CPU` |
| `EB_FFMPEG_PATH` | Path to ffmpeg binary | auto-detected or bundled |
| `EB_FFPROBE_PATH` | Path to ffprobe binary | auto-detected or bundled |
| `EB_RANDOMIZE_NAMES` | Randomize uploaded file names | `false` |

#### Video Processing

When `EB_PROCESS_VIDEO` is enabled (which is the default), Embedder will:

1. Process uploaded videos to create optimized 720p versions
2. Show "Copy as GIFv" links for video files
3. Display a processing spinner while videos are being optimized

If disabled by setting `EB_PROCESS_VIDEO=false`, videos will be served directly without processing, which can be useful on systems with limited resources.

### Using Docker

```bash
docker run -d -p "3000:3000" \
  -e EBPORT=3000 \
  -e EBPASS=changeme \
  -e EBAPI_KEY=changeme \
  -e EB_PROCESS_VIDEO=true \
  ghcr.io/waveringana/embedder:1.14
```

### Docker Compose

```yaml
services:
  embedder:
    ports:
      - "3000:3000"
    environment:
      - EBPORT=3000
      - EBPASS=changeme
      - EBAPI_KEY=changeme
      - EB_PROCESS_VIDEO=true
    volumes:
      - ./db:/var/db
      - ./uploads:/uploads
    image: ghcr.io/waveringana/embedder:1.14
```

## 📜 License

Distributed under [The Unlicense](https://opensource.org/licenses/unlicense).
