import { EventEmitter } from "events";

import WebSocket from "ws";

const eventEmitter = new EventEmitter();

const wsPort = normalizePort(process.env.EBWSPORT || "3001");

const clients: WebSocket[] = [];

/**
 * Normalizes a port number to ensure it is a valid integer.
 *
 * @param {string} val - The port number as a string.
 * @returns {number} The normalized port number.
 */
function normalizePort(val: string) {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
        return parseInt(val);
    }

    if (port >= 0) {
        return port;
    }
}
/**
 * The WebSocket server instance.
 */
const wss = new WebSocket.Server({port: wsPort});

wss.on("connection", (ws) => {
    clients.push(ws);

    ws.on("message", handleMessage);
  
    ws.on("close", handleMessage);
  
    ws.on("error", handleMessage);

    ws.on("close", () => {
        const index = clients.indexOf(ws);
        if (index !== -1) {
            clients.splice(index, 1);
        }
    });
});

/**
 * Handles incoming messages from clients.
 *
 * @param {string} message - The incoming message.
 */
function handleMessage(message: string) {
    try {
        const data = JSON.parse(message);
  
        switch (data.type) {
            case "message":
                eventEmitter.emit("message", data.message);
                break;
            case "close":
                eventEmitter.emit("close", data.userId);
                break;
            case "error":
                eventEmitter.emit("error", data.error);
                break;
            default:
                console.log(`Unknown message type: ${data.type}`);
        }
    } catch (error) {
        console.log(`Error parsing message: ${error}`);
    }
}

/**
 * Broadcasts a message to all connected clients.
 *
 * @param {string} message - The message to broadcast.
 */
function broadcast(message: string) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

/**
 * Returns an array of all connected clients.
 *
 * @returns {WebSocket[]} An array of connected clients.
 */
function getClients() {
    return clients;
}

/**
 * Sends a message to a specific client.
 *
 * @param {string} clientId - The ID of the client to send the message to.
 * @param {string} message - The message to send.
 */
/*function sendMessageToClient(clientId: string, message: string) {
    const client = clients.find((client) => client.id === clientId);
    if (client) {
        client.send(message);
    }
}*/



//export { wss, eventEmitter, broadcast, getClients, sendMessageToClient };

