const socket = (window as any).io();

const roomInput = document.getElementById('roomId') as HTMLInputElement;
const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;
const toggleCamBtn = document.getElementById('toggleCamBtn') as HTMLButtonElement;
const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;

let localStream: MediaStream | null = null;
let pc: RTCPeerConnection | null = null;
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

function createPeerConnection() {
  pc = new RTCPeerConnection({ iceServers });
  if (!localStream) return;

  localStream.getTracks().forEach(track => pc!.addTrack(track, localStream!));

  pc!.addEventListener('track', (e) => {
    const [stream] = e.streams;
    remoteVideo.srcObject = stream;
  });

  pc!.addEventListener('icecandidate', (e) => {
    if (e.candidate && roomId) {
      socket.emit('signal', { roomId, data: { type: 'candidate', candidate: e.candidate } });
    }
  });
}

async function makeCall() {
  if (!pc) return;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('signal', { roomId, data: { type: 'offer', sdp: offer.sdp } });
}

async function handleOffer(from: string, sdp: string) {
  if (!pc) return;
  await pc.setRemoteDescription({ type: 'offer', sdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('signal', { roomId, data: { type: 'answer', sdp: answer.sdp } });
}

async function handleAnswer(sdp: string) {
  if (!pc) return;
  await pc.setRemoteDescription({ type: 'answer', sdp });
}

async function handleCandidate(candidate: RTCIceCandidateInit) {
  if (!pc) return;
  try {
    await pc.addIceCandidate(candidate);
  } catch {}
}

joinBtn.addEventListener('click', async () => {
  roomId = roomInput.value.trim();
  if (!roomId) return alert('Ingresa un ID de sala');

  await initMedia();
  createPeerConnection();

  socket.emit('join', roomId);
});

socket.on('peer-joined', async () => {
  if (pc) await makeCall();
});

socket.on('signal', async ({ from, data }: { from: string; data: any }) => {
  switch (data.type) {
    case 'offer':
      await handleOffer(from, data.sdp);
      break;
    case 'answer':
      await handleAnswer(data.sdp);
      break;
    case 'candidate':
      await handleCandidate(data.candidate);
      break;
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
