const socket = (window as any).io();

const roomInput = document.getElementById('roomId') as HTMLInputElement;
const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;
const toggleCamBtn = document.getElementById('toggleCamBtn') as HTMLButtonElement;
const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
const remoteContainer = document.getElementById('remoteContainer') as HTMLElement;

let localStream: MediaStream | null = null;
const peerConnections = new Map<string, RTCPeerConnection>();
const remoteVideos = new Map<string, HTMLVideoElement>();
let roomId: string | null = null;

const iceServers: RTCIceServer[] = [];
fetch('/ice.json')
  .then(r => r.ok ? r.json() : { iceServers: [] })
  .then(cfg => {
    if (cfg && Array.isArray(cfg.iceServers)) {
      iceServers.push(...cfg.iceServers);
    }
  })
  .catch(() => {});

async function initMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

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

async function makeCall(peerId: string) {
  const pc = createPeerConnection(peerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('signal', { roomId, data: { type: 'offer', sdp: offer.sdp, to: peerId } });
}

async function handleOffer(from: string, sdp: string) {
  const pc = createPeerConnection(from);
  await pc.setRemoteDescription({ type: 'offer', sdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('signal', { roomId, data: { type: 'answer', sdp: answer.sdp, to: from } });
}

async function handleAnswer(from: string, sdp: string) {
  const pc = peerConnections.get(from);
  if (!pc) return;
  await pc.setRemoteDescription({ type: 'answer', sdp });
}

async function handleCandidate(from: string, candidate: RTCIceCandidateInit) {
  const pc = peerConnections.get(from);
  if (!pc) return;
  try {
    await pc.addIceCandidate(candidate);
  } catch {}
}

joinBtn.addEventListener('click', async () => {
  roomId = roomInput.value.trim();
  if (!roomId) return alert('Ingresa un ID de sala');

  await initMedia();
  socket.emit('join', roomId);
});

socket.on('peer-joined', async (peerId: string) => {
  await makeCall(peerId);
});

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

let camEnabled = true;

toggleCamBtn.addEventListener('click', () => {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;
  camEnabled = !camEnabled;
  videoTrack.enabled = camEnabled;
  toggleCamBtn.textContent = camEnabled ? 'Apagar cámara' : 'Encender cámara';
});
