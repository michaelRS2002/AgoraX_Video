# AgoraX Video 🎥

A real-time peer-to-peer video conferencing web platform built with WebRTC, Socket.IO, and TypeScript.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Authors](#-authors)
- [License](#license)

## Overview

AgoraX Video is a lightweight video conferencing application that enables real-time peer-to-peer video and audio communication through WebRTC technology. The platform uses a signaling server to establish connections between peers, with support for STUN/TURN servers for NAT traversal.

## Features

✨ **Core Features:**
- 🎥 Real-time video and audio streaming
- 👥 Multi-peer video conferencing
- 🔄 Dynamic peer connection management
- 📹 Camera toggle on/off functionality
- 🌐 Browser-based (no plugins required)
- 🔒 Peer-to-peer connections (reduced server load)

🔧 **Technical Features:**
- WebRTC peer connections with ICE negotiation
- Socket.IO signaling server
- STUN/TURN server support for NAT traversal
- TypeScript for type safety
- Configurable ICE servers via environment variables

## Technology Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** (v5.2.1) - Web application framework
- **Socket.IO** (v4.8.1) - Real-time bidirectional communication
- **TypeScript** (v5.9.3) - Type-safe JavaScript
- **dotenv** (v16.6.1) - Environment variable management

### Frontend
- **WebRTC API** - Peer-to-peer communication
- **Socket.IO Client** - Real-time signaling
- **TypeScript** - Type-safe client code
- **Native HTML5 Video** - Media rendering

## Architecture

```
┌─────────────┐         Signaling         ┌─────────────┐
│   Client A  │◄────────(Socket.IO)───────►│   Client B  │
└──────┬──────┘                            └──────┬──────┘
       │                                          │
       │         ┌──────────────────┐            │
       └────────►│  Signaling Server│◄───────────┘
                 │   (Express + IO) │
                 └──────────────────┘
                          │
                          ▼
                 ICE Configuration
                 (STUN/TURN Servers)

       ┌─────────────────────────────────┐
       │  Direct P2P Connection (WebRTC) │
       │     Audio/Video Streams         │
       └─────────────────────────────────┘
```

### How It Works

1. **Signaling Phase:**
   - Clients connect to the signaling server via Socket.IO
   - Peers exchange SDP offers/answers through the server
   - ICE candidates are shared for NAT traversal

2. **Connection Phase:**
   - WebRTC establishes direct peer-to-peer connections
   - STUN/TURN servers help traverse NAT/firewalls
   - Media streams are negotiated and exchanged

3. **Communication Phase:**
   - Video and audio data flows directly between peers
   - Minimal server involvement after connection establishment

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Modern web browser with WebRTC support

### Steps

1. **Clone the repository:**
```bash
git clone https://github.com/michaelRS2002/AgoraX_Video.git
cd AgoraX_Video
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
# Copy the example .env file
cp .env.example .env

# Edit .env with your configuration
```

4. **Build the project:**
```bash
npm run build
```

5. **Start the server:**
```bash
npm start
```

For development with hot-reload:
```bash
npm run dev
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Port
PORT=5000

# STUN Server (Public Google STUN server)
STUN_SERVER=stun:stun.l.google.com:19302

# Complete ICE Servers Configuration (STUN + TURN)
ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:relay1.expressturn.com:3480","username":"YOUR_USERNAME","credential":"YOUR_CREDENTIAL"}]
```

### ICE Server Configuration

The application supports three methods of ICE server configuration (in priority order):

1. **Full JSON Configuration** (Recommended):
   - Set `ICE_SERVERS` environment variable with complete JSON array
   - Supports multiple STUN and TURN servers

2. **Individual Variables**:
   - `STUN_URL` or `STUN_SERVER` - STUN server URL
   - `TURN_URL` - TURN server URL
   - `TURN_USERNAME` - TURN authentication username
   - `TURN_PASSWORD` - TURN authentication password

3. **Fallback Defaults**:
   - Google's public STUN server
   - Expressturn public TURN server (limited)

### Custom TURN Servers

For production environments, consider using:
- [Twilio TURN](https://www.twilio.com/stun-turn)
- [Xirsys](https://xirsys.com/)
- [Metered.ca](https://www.metered.ca/stun-turn)
- Self-hosted [coturn](https://github.com/coturn/coturn)

## Usage

### Joining a Conference

1. Open your browser and navigate to `http://localhost:5000`
2. Enter a room ID in the input field
3. Click "Unirse" (Join) button
4. Allow camera and microphone access when prompted
5. Share the same room ID with other participants

### Controls

- **Toggle Camera**: Click "Apagar cámara" / "Encender cámara" to turn camera on/off
- Audio and video continue to work with other peers even when your camera is off

### Multi-Peer Conferencing

- Multiple users can join the same room by using the same room ID
- Each peer's video will appear in a separate section
- Connections are established automatically when peers join

## Project Structure

```
AgoraX_Video/
├── src/
│   ├── server.ts           # Signaling server (Socket.IO + Express)
│   └── client/
│       └── app.ts          # Client-side WebRTC logic
├── public/
│   ├── index.html          # Main HTML interface
│   └── app.js              # Compiled client JavaScript
├── dist/                   # Compiled server code
├── package.json            # Project dependencies
├── tsconfig.json           # TypeScript config (server)
├── tsconfig.client.json    # TypeScript config (client)
├── .env                    # Environment variables
└── README.md               # This file
```

### Key Files

- **`server.ts`**: Express server with Socket.IO signaling implementation
- **`client/app.ts`**: WebRTC client logic with peer connection management
- **`index.html`**: User interface for video conferencing

## API Documentation

### Server Endpoints

#### `GET /`
Serves the static HTML interface

#### `GET /ice.json`
Returns ICE server configuration

**Response:**
```json
{
  "iceServers": [
    {
      "urls": "stun:stun.l.google.com:19302"
    },
    {
      "urls": "turn:relay1.expressturn.com:3480",
      "username": "username",
      "credential": "credential"
    }
  ]
}
```

### Socket.IO Events

#### Client → Server

**`join`**
- **Payload**: `roomId: string`
- **Description**: Client requests to join a conference room

**`signal`**
- **Payload**: `{ roomId: string, data: SignalData }`
- **Description**: WebRTC signaling data (offer/answer/ICE candidate)

#### Server → Client

**`peer-joined`**
- **Payload**: `peerId: string`
- **Description**: Notifies about a new peer joining the room

**`signal`**
- **Payload**: `{ from: string, data: SignalData }`
- **Description**: Relays WebRTC signaling data between peers

**`peer-left`**
- **Payload**: `peerId: string`
- **Description**: Notifies that a peer has disconnected

### TypeScript Documentation

The codebase is fully documented using TSDoc comments. Key functions include:

#### Server (`server.ts`)
- ICE configuration endpoint handler
- Socket.IO connection management
- Room join/leave logic
- Signal relay implementation

#### Client (`client/app.ts`)
- `initMedia()` - Initialize local camera and microphone
- `createPeerConnection(peerId)` - Create RTCPeerConnection for a peer
- `makeCall(peerId)` - Initiate a WebRTC call
- `handleOffer(from, sdp)` - Process incoming call offers
- `handleAnswer(from, sdp)` - Process call answers
- `handleCandidate(from, candidate)` - Process ICE candidates

## 👥 Authors

**Equipo AgoraX**
- GitHub: [@michaelRS2002](https://github.com/michaelRS2002)
- Github: [@AirWa1l](https://github.com/AirWa1l)
- Github: [@Mausterl26](https://github.com/Mausterl26)
- Github: [@LjuandalZPH](https://github.com/LjuandalZPH)
- Github: [@vilhood](https://github.com/vilhood)

---

**Built with ❤️ by the AgoraX Team**
