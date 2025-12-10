/**
 * @fileoverview WebRTC Video Conference Client Application
 * 
 * This module implements the client-side logic for a peer-to-peer video
 * conferencing application using WebRTC. It handles media streams, peer
 * connections, and signaling through Socket.IO.
 * 
 * @module client/app
 * @requires socket.io-client
 * @version 0.1.0
 */

/**
 * Socket.IO client instance for signaling communication with the server
 * @type {Socket}
 */
const socket = (window as any).io();

/**
 * Input element for entering the room ID
 * @type {HTMLInputElement}
 */
const roomInput = document.getElementById('roomId') as HTMLInputElement;

/**
 * Button element to join a conference room
 * @type {HTMLButtonElement}
 */
const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;

/**
 * Button element to toggle camera on/off
 * @type {HTMLButtonElement}
 */
const toggleCamBtn = document.getElementById('toggleCamBtn') as HTMLButtonElement;

/**
 * Video element displaying the local user's camera feed
 * @type {HTMLVideoElement}
 */
const localVideo = document.getElementById('localVideo') as HTMLVideoElement;

/**
 * Container element for displaying remote peer video feeds
 * @type {HTMLElement}
 */
const remoteContainer = document.getElementById('remoteContainer') as HTMLElement;

/**
 * Local media stream containing audio and video tracks
 * @type {MediaStream | null}
 */
let localStream: MediaStream | null = null;

/**
 * Map of peer socket IDs to their RTCPeerConnection instances
 * @type {Map<string, RTCPeerConnection>}
 */
const peerConnections = new Map<string, RTCPeerConnection>();

/**
 * Map of peer socket IDs to their remote video elements
 * @type {Map<string, HTMLVideoElement>}
 */
const remoteVideos = new Map<string, HTMLVideoElement>();

/**
 * Current conference room ID, null if not in a room
 * @type {string | null}
 */
let roomId: string | null = null;

/**
 * Array of ICE server configurations for NAT traversal (STUN/TURN)
 * @type {RTCIceServer[]}
 */
const iceServers: RTCIceServer[] = [];

/**
 * Fetches ICE server configuration from the server
 * Populates the iceServers array with STUN/TURN server information
 * 
 * @async
 * @returns {Promise<void>}
 */
fetch('/ice.json')
  .then(r => r.ok ? r.json() : { iceServers: [] })
  .then(cfg => {
    if (cfg && Array.isArray(cfg.iceServers)) {
      iceServers.push(...cfg.iceServers);
    }
  })
  .catch(() => {});

/**
 * Initializes local media by requesting camera and microphone access
 * Sets the local video element's source to the acquired media stream
 * 
 * @async
 * @function initMedia
 * @returns {Promise<void>}
 * @throws {Error} If media access is denied or unavailable
 */
async function initMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

/**
 * Creates or retrieves an RTCPeerConnection for a specific peer
 * 
 * Sets up the peer connection with ICE servers, adds local media tracks,
 * handles incoming remote tracks, and manages ICE candidate generation.
 * 
 * @function createPeerConnection
 * @param {string} peerId - The unique socket ID of the remote peer
 * @returns {RTCPeerConnection} The peer connection instance
 * 
 * @fires track - When a remote media track is received
 * @fires icecandidate - When an ICE candidate is generated
 */
function createPeerConnection(peerId: string) {
  if (peerConnections.has(peerId)) return peerConnections.get(peerId)!;

  const pc = new RTCPeerConnection({ iceServers });
  peerConnections.set(peerId, pc);

  if (!localStream) return pc;

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream!));

  pc.addEventListener('track', (e) => {
    const [stream] = e.streams;
    if (!remoteVideos.has(peerId)) {
      const videoWrapper = document.createElement('section');
      const title = document.createElement('h3');
      title.textContent = `Peer ${peerId.slice(0, 6)}`;
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.style.width = '100%';
      video.style.borderRadius = '8px';
      video.style.background = '#000';
      videoWrapper.appendChild(title);
      videoWrapper.appendChild(video);
      remoteContainer.appendChild(videoWrapper);
      remoteVideos.set(peerId, video);
    }
    const video = remoteVideos.get(peerId)!;
    video.srcObject = stream;
  });

  pc.addEventListener('icecandidate', (e) => {
    if (e.candidate && roomId) {
      socket.emit('signal', { roomId, data: { type: 'candidate', candidate: e.candidate, to: peerId } });
    }
  });

  return pc;
}

/**
 * Initiates a WebRTC call to a remote peer
 * 
 * Creates an SDP offer and sends it to the peer through the signaling server
 * 
 * @async
 * @function makeCall
 * @param {string} peerId - The unique socket ID of the peer to call
 * @returns {Promise<void>}
 * 
 * @emits signal - Sends the offer to the peer via signaling server
 */
async function makeCall(peerId: string) {
  const pc = createPeerConnection(peerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('signal', { roomId, data: { type: 'offer', sdp: offer.sdp, to: peerId } });
}

/**
 * Handles an incoming WebRTC offer from a remote peer
 * 
 * Creates a peer connection, sets the remote description, generates an answer,
 * and sends it back to the offering peer
 * 
 * @async
 * @function handleOffer
 * @param {string} from - The socket ID of the peer sending the offer
 * @param {string} sdp - The Session Description Protocol offer string
 * @returns {Promise<void>}
 * 
 * @emits signal - Sends the answer back to the peer
 */
async function handleOffer(from: string, sdp: string) {
  const pc = createPeerConnection(from);
  await pc.setRemoteDescription({ type: 'offer', sdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('signal', { roomId, data: { type: 'answer', sdp: answer.sdp, to: from } });
}

/**
 * Handles an incoming WebRTC answer from a remote peer
 * 
 * Sets the remote description on the existing peer connection
 * 
 * @async
 * @function handleAnswer
 * @param {string} from - The socket ID of the peer sending the answer
 * @param {string} sdp - The Session Description Protocol answer string
 * @returns {Promise<void>}
 */
async function handleAnswer(from: string, sdp: string) {
  const pc = peerConnections.get(from);
  if (!pc) return;
  await pc.setRemoteDescription({ type: 'answer', sdp });
}

/**
 * Handles an incoming ICE candidate from a remote peer
 * 
 * Adds the ICE candidate to the existing peer connection for NAT traversal
 * 
 * @async
 * @function handleCandidate
 * @param {string} from - The socket ID of the peer sending the candidate
 * @param {RTCIceCandidateInit} candidate - The ICE candidate data
 * @returns {Promise<void>}
 */
async function handleCandidate(from: string, candidate: RTCIceCandidateInit) {
  const pc = peerConnections.get(from);
  if (!pc) return;
  try {
    await pc.addIceCandidate(candidate);
  } catch {}
}

/**
 * Join Button Click Event Handler
 * 
 * Handles the user's request to join a conference room.
 * Validates the room ID, initializes local media, and emits a join event
 * 
 * @event click
 * @listens joinBtn#click
 * @emits join - Notifies the server to join the specified room
 */
joinBtn.addEventListener('click', async () => {
  roomId = roomInput.value.trim();
  if (!roomId) return alert('Ingresa un ID de sala');

  await initMedia();
  socket.emit('join', roomId);
});

/**
 * Peer Joined Event Handler
 * 
 * Triggered when a new peer joins the conference room.
 * Initiates a WebRTC call to the newly joined peer
 * 
 * @event peer-joined
 * @listens socket#peer-joined
 * @param {string} peerId - The socket ID of the newly joined peer
 */
socket.on('peer-joined', async (peerId: string) => {
  await makeCall(peerId);
});

/**
 * Signal Event Handler
 * 
 * Handles incoming WebRTC signaling messages (offers, answers, ICE candidates)
 * from remote peers via the signaling server
 * 
 * @event signal
 * @listens socket#signal
 * @param {Object} payload - Signaling message payload
 * @param {string} payload.from - The socket ID of the peer sending the signal
 * @param {Object} payload.data - The signaling data
 * @param {string} payload.data.type - Type of signal (offer/answer/candidate)
 * @param {string} [payload.data.sdp] - SDP string for offer/answer
 * @param {RTCIceCandidateInit} [payload.data.candidate] - ICE candidate data
 */
socket.on('signal', async ({ from, data }: { from: string; data: any }) => {
  switch (data.type) {
    case 'offer':
      await handleOffer(from, data.sdp);
      break;
    case 'answer':
      await handleAnswer(from, data.sdp);
      break;
    case 'candidate':
      await handleCandidate(from, data.candidate);
      break;
  }
});

/**
 * Peer Left Event Handler
 * 
 * Triggered when a peer disconnects from the conference room.
 * Closes the peer connection and removes the remote video element
 * 
 * @event peer-left
 * @listens socket#peer-left
 * @param {string} peerId - The socket ID of the peer that left
 */
socket.on('peer-left', (peerId: string) => {
  const pc = peerConnections.get(peerId);
  if (pc) {
    pc.close();
    peerConnections.delete(peerId);
  }
  const video = remoteVideos.get(peerId);
  if (video) {
    video.srcObject = null;
    video.parentElement?.remove();
    remoteVideos.delete(peerId);
  }
});

/**
 * Camera enabled state flag
 * @type {boolean}
 */
let camEnabled = true;

/**
 * Toggle Camera Button Click Event Handler
 * 
 * Toggles the local video track on/off and updates the button text
 * 
 * @event click
 * @listens toggleCamBtn#click
 */
toggleCamBtn.addEventListener('click', () => {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;
  camEnabled = !camEnabled;
  videoTrack.enabled = camEnabled;
  toggleCamBtn.textContent = camEnabled ? 'Apagar cámara' : 'Encender cámara';
});
