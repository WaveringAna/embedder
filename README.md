# Embedder

A media host specialized in good looking embeds for services like Discord. No file size limits. No compression.

<img src="readmegif.gif">

Upcoming Features: 
* Guest user accounts
* MariaDB/SQL support (uses sqlite for now)

Potential:
* IPFS

## Run

Source:
```Bash
$ export EBPASS=changeme
$ export EBPORT=3000
$ export EBAPI_KEY=changeme #ShareX support

$ npm install
$ npm start
```
Default username is admin with the password being whatever EBPASS is

ShareX support is enabled at "/upload", requires auth with key, expire key is in days 
JSON
```
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

Docker Config
```
docker run -d -p "3000:3000" -e EBPORT=3000 -e EBPASS=changeme -e EBAPI_KEY=changeme ghcr.io/waveringana/embedder:1.7.2
```

Docker Compose
```
version: '3.3'
services:
    embedder:
        ports:
            - '3000:3000'
        environment:
            - EBPORT=3000
            - EBPASS=changeme
            - EBAPI_KEY=changeme
        volumes:
            - ./db:/var/db
            - ./uploads:/uploads
        image: ghcr.io/waveringana/embedder:1.7.2
```

## License

[The Unlicense](https://opensource.org/licenses/unlicense)
