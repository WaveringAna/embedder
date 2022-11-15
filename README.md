# Embedder

A media host specialized in good looking embeds for services like Discord

<img src="readmegif.gif">

## Run

Source:
```Bash
EBPASS=changeme
EBPORT=3000
EBSECRET=4jkdmakl2l #jwt session secret

$ npm install
$ node db.js
$ npm start
```

Docker
```
docker build . -t embedder
docker run -d -p "4000:4000" -e EBPORT=4000 -e EBPASS=pass -e EBSECRET=4jkdmakl2l embedder
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
        volumes:
            - embedderdb:/var/db
            - embedderuploads:/uploads
        image: embedder
        network_mode: bridge
volumes:
    embedderdb:
    embedderuploads:
```

## License

[The Unlicense](https://opensource.org/licenses/unlicense)
