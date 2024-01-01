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

### Using Docker

```bash
docker run -d -p "3000:3000" -e EBPORT=3000 -e EBPASS=changeme -e EBAPI_KEY=changeme ghcr.io/waveringana/embedder:1.10.2
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
    image: ghcr.io/waveringana/embedder:1.10.2
```

## 📜 License

Distributed under [The Unlicense](https://opensource.org/licenses/unlicense).
