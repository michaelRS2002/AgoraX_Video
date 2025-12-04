import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));

// Provide ICE config from env via simple endpoint
// Set STUN_URL (and optionally STUN_USERNAME/STUN_PASSWORD for TURN) in .env
app.get('/ice.json', (_req: Request, res: Response) => {
  const stunUrl = process.env.STUN_URL; // e.g., stun:localhost:3478
  const turnUrl = process.env.TURN_URL; // e.g., turn:localhost:3478
  const turnUser = process.env.TURN_USERNAME;
  const turnPass = process.env.TURN_PASSWORD;

  const iceServers: any[] = [];
  if (stunUrl) iceServers.push({ urls: [stunUrl] });
  if (turnUrl && turnUser && turnPass) iceServers.push({ urls: [turnUrl], username: turnUser, credential: turnPass });

  res.json({ iceServers });
});

io.on('connection', (socket) => {
  socket.on('join', (roomId: string) => {
    socket.join(roomId);
    socket.to(roomId).emit('peer-joined', socket.id);
  });

  socket.on('signal', ({ roomId, data }: { roomId: string; data: any }) => {
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
