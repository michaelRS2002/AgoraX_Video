/**
 * @fileoverview WebRTC Video Conference Signaling Server
 * 
 * This module implements a signaling server for WebRTC peer-to-peer video conferencing.
 * It uses Socket.IO for real-time communication and provides ICE server configuration
 * for NAT traversal (STUN/TURN servers).
 * 
 * @module server
 * @requires express
 * @requires http
 * @requires socket.io
 * @requires path
 * @requires dotenv
 */

import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Express application instance
 * @type {express.Application}
 */
const app = express();

/**
 * HTTP server instance wrapping the Express app
 * @type {http.Server}
 */
const server = http.createServer(app);

/**
 * Socket.IO server instance for real-time signaling
 * Configured with CORS to allow connections from any origin
 * @type {Server}
 */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/**
 * Server port number, defaults to 3000 if not specified in environment
 * @type {number}
 */
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));

/**
 * ICE Configuration Endpoint
 * 
 * Provides ICE server configuration (STUN/TURN) for WebRTC connections.
 * Tries multiple configuration sources in priority order:
 * 1. ICE_SERVERS environment variable (full JSON array)
 * 2. Individual STUN_URL/TURN_URL environment variables
 * 3. Fallback to public STUN server and Expressturn TURN server
 * 
 * @route GET /ice.json
 * @param {Request} _req - Express request object (unused)
 * @param {Response} res - Express response object
 * @returns {Object} JSON response containing iceServers array
 * 
 * @example
 * // Response format:
 * {
 *   "iceServers": [
 *     { "urls": "stun:stun.l.google.com:19302" },
 *     { "urls": "turn:relay1.expressturn.com:3480", "username": "...", "credential": "..." }
 *   ]
 * }
 */
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

/**
 * Socket.IO Connection Handler
 * 
 * Manages WebSocket connections and implements the signaling protocol
 * for WebRTC peer discovery and connection establishment.
 * 
 * @event connection
 * @param {Socket} socket - Socket.IO client socket instance
 * 
 * @listens join - Client wants to join a room
 * @listens signal - WebRTC signaling data (offer/answer/ICE candidates)
 * @listens disconnecting - Client is disconnecting
 */
io.on('connection', (socket) => {
  /**
   * Join Room Event Handler
   * 
   * Handles a peer joining a video conference room. Notifies the new peer
   * about existing peers and notifies existing peers about the new peer.
   * 
   * @event join
   * @param {string} roomId - The unique identifier for the conference room
   * 
   * @fires peer-joined - Emitted to notify peers about new participant
   */
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

  /**
   * Signal Event Handler
   * 
   * Relays WebRTC signaling data between peers. Handles offers, answers,
   * and ICE candidates for establishing peer connections.
   * 
   * @event signal
   * @param {Object} payload - Signaling data payload
   * @param {string} payload.roomId - The room identifier
   * @param {Object} payload.data - WebRTC signaling data (offer/answer/candidate)
   * @param {string} [payload.data.to] - Optional target peer socket ID
   * 
   * @fires signal - Relays signaling data to target peer or room
   */
  socket.on('signal', ({ roomId, data }: { roomId: string; data: any }) => {
    const target = data.to;
    if (target) {
      io.to(target).emit('signal', { from: socket.id, data });
    } else {
      socket.to(roomId).emit('signal', { from: socket.id, data });
    }
  });

  /**
   * Disconnecting Event Handler
   * 
   * Handles peer disconnection by notifying all peers in the same rooms
   * that this peer is leaving.
   * 
   * @event disconnecting
   * @fires peer-left - Notifies other peers in the room about disconnection
   */
  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms].filter(r => r !== socket.id);
    rooms.forEach(roomId => {
      socket.to(roomId).emit('peer-left', socket.id);
    });
  });
});

/**
 * Starts the HTTP server and begins listening for connections
 * 
 * @param {number} PORT - The port number to listen on
 * @callback - Logs server startup information to console
 */
server.listen(PORT, () => {
  console.log(`Signaling server listening on http://localhost:${PORT}`);
});
