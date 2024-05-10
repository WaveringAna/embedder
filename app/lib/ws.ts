import WebSocket from "ws";

const wsPort = normalizePort(process.env.EBWSPORT || "3001");

function normalizePort(val: string) {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
        return parseInt(val);
    }

    if (port >= 0) {
        return port;
    }
}

const wss = new WebSocket.Server({port: wsPort});

export { wss };

