# Embedder

A media host specialized in good looking embeds for services like Discord. No file size limits. No compression.

<img src="readmegif.gif">

Upcoming Features: 
* Smooth out mp4s similar to imgur and gfycat
* Guest user accounts
* ShareX support
* Expirey/auto-delete support


## Run

Source:
```Bash
EBPASS=changeme
EBPORT=4000
EBAPI_KEY=changeme #ShareX support

$ npm install
$ node db.js
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

Docker config
```
docker run -d -p "4000:4000" -e EBPORT=4000 -e EBPASS=changeme -e EBAPI_KEY=changeme waveringana/embedder:latest
```

Docker Compose
```
version: '3.3'
services:
    embedder:
        ports:
            - '4000:4000'
        environment:
            - EBPORT=4000
            - EBPASS=changeme
            - EBAPI_KEY=changeme
        volumes:
            - embedderdb:/var/db
            - embedderuploads:/uploads
        image: waveringana/embedder:latest
        network_mode: bridge
volumes:
    embedderdb:
    embedderuploads:
```

## License

[The Unlicense](https://opensource.org/licenses/unlicense)
