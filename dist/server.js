"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server);
const PORT = process.env.PORT || 3000;
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Provide ICE config from env via simple endpoint
// Set STUN_URL (and optionally STUN_USERNAME/STUN_PASSWORD for TURN) in .env
app.get('/ice.json', (_req, res) => {
    const stunUrl = process.env.STUN_URL; // e.g., stun:localhost:3478
    const turnUrl = process.env.TURN_URL; // e.g., turn:localhost:3478
    const turnUser = process.env.TURN_USERNAME;
    const turnPass = process.env.TURN_PASSWORD;
    const iceServers = [];
    if (stunUrl)
        iceServers.push({ urls: [stunUrl] });
    if (turnUrl && turnUser && turnPass)
        iceServers.push({ urls: [turnUrl], username: turnUser, credential: turnPass });
    res.json({ iceServers });
});
io.on('connection', (socket) => {
    socket.on('join', (roomId) => {
        socket.join(roomId);
        socket.to(roomId).emit('peer-joined', socket.id);
    });
    socket.on('signal', ({ roomId, data }) => {
        socket.to(roomId).emit('signal', { from: socket.id, data });
    });
    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms].filter(r => r !== socket.id);
        rooms.forEach(roomId => {
            socket.to(roomId).emit('peer-left', socket.id);
        });
    });
});
server.listen(PORT, () => {
    console.log(`Signaling server listening on http://localhost:${PORT}`);
});
