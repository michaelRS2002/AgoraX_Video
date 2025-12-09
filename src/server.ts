import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));

// Provide ICE config from env via simple endpoint
// Supports both env vars and hardcoded fallback to Metered TURN servers
app.get('/ice.json', (_req: Request, res: Response) => {
  // 1. Try to parse full ICE_SERVERS JSON from env
  if (process.env.ICE_SERVERS) {
    try {
      const parsed = JSON.parse(process.env.ICE_SERVERS);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json({ iceServers: parsed });
      }
    } catch (e) {
      console.warn('Failed to parse ICE_SERVERS env var', e);
    }
  }

  // 2. Fallback to individual variables
  const stunUrl = process.env.STUN_URL || process.env.STUN_SERVER;
  const turnUrl = process.env.TURN_URL;
  const turnUser = process.env.TURN_USERNAME;
  const turnPass = process.env.TURN_PASSWORD;

  const iceServers: any[] = [];
  
  // If env vars configured, use them
  if (stunUrl) iceServers.push({ urls: [stunUrl] });
  if (turnUrl && turnUser && turnPass) {
    iceServers.push({ urls: [turnUrl], username: turnUser, credential: turnPass });
  }

  // 3. Fallback: use Expressturn servers (updated)
  if (iceServers.length === 0) {
    iceServers.push(
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "turn:relay1.expressturn.com:3480", username: "000000002080620133", credential: "GyE7aQ0fUCZbERGEKKd1LYh7DgQ=" }
    );
  }

  res.json({ iceServers });
});

io.on('connection', (socket) => {
  socket.on('join', (roomId: string) => {
    // Notify new peer about existing peers
    const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
    if (socketsInRoom) {
      socketsInRoom.forEach(existingSocketId => {
        if (existingSocketId !== socket.id) {
          socket.emit('peer-joined', existingSocketId);
        }
      });
    }
    
    socket.join(roomId);
    // Notify existing peers about new peer
    socket.to(roomId).emit('peer-joined', socket.id);
  });

  socket.on('signal', ({ roomId, data }: { roomId: string; data: any }) => {
    const target = data.to;
    if (target) {
      io.to(target).emit('signal', { from: socket.id, data });
    } else {
      socket.to(roomId).emit('signal', { from: socket.id, data });
    }
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
