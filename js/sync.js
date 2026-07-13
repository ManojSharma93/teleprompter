const THROTTLE_MS = 30;
const POLL_DEFAULT_MS = 200;

export function createSync({
  signaling,
  newPeer = () => new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
      // Public free-tier TURN relay (OpenRelay project) — used as a fallback
      // when STUN alone can't traverse NAT (e.g. phone on mobile data).
      // Shared/rate-limited; swap for a private TURN key if pairing gets flaky.
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 4,
  }),
  pollIntervalMs = POLL_DEFAULT_MS,
} = {}) {
  let peer = null;
  let channel = null;
  let role = null;
  let code = null;
  let status = 'disconnected';
  const statusListeners = new Set();
  const stateListeners = new Set();

  let lastSendAt = 0;
  let pendingState = null;
  let pendingTimer = null;

  function setStatus(s) {
    status = s;
    statusListeners.forEach((cb) => cb(s));
  }

  async function connectController(roomCode) {
    code = roomCode;
    role = 'controller';
    setStatus('pairing');

    await signaling.createRoom(roomCode);
    peer = newPeer();
    channel = peer.createDataChannel('state');
    wireChannel(channel);
    wirePeer(peer);

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await signaling.setOffer(roomCode, offer.sdp);

    while (status === 'pairing') {
      const answerSdp = await signaling.getAnswer(roomCode);
      if (answerSdp) {
        await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp });
        break;
      }
      await sleep(pollIntervalMs);
    }

    pollIce();
    await waitForChannelOpen(channel);
    setStatus('connected');
  }

  async function connectDisplay(roomCode) {
    code = roomCode;
    role = 'display';
    setStatus('pairing');

    const joined = await signaling.joinRoom(roomCode);
    if (!joined) throw new Error('room-not-found');

    peer = newPeer();
    wirePeer(peer);

    let offerSdp = null;
    while (!offerSdp && status === 'pairing') {
      offerSdp = await signaling.getOffer(roomCode);
      if (!offerSdp) await sleep(pollIntervalMs);
    }
    await peer.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await signaling.setAnswer(roomCode, answer.sdp);

    pollIce();
    channel = await waitForIncomingChannel(peer);
    wireChannel(channel);
    await waitForChannelOpen(channel);
    setStatus('connected');
  }

  function wirePeer(p) {
    p.onicecandidate = (e) => {
      if (e.candidate) {
        signaling.addIce(code, role, JSON.stringify(e.candidate));
      }
    };
    p.onconnectionstatechange = () => {
      if (p.connectionState === 'failed' || p.connectionState === 'closed') {
        setStatus('disconnected');
      }
    };
  }

  function wireChannel(ch) {
    ch.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        stateListeners.forEach((cb) => cb(parsed));
      } catch {
        // ignore malformed
      }
    };
    ch.onclose = () => setStatus('disconnected');
  }

  async function pollIce() {
    while (status === 'pairing' || status === 'connected') {
      try {
        const { controller, display } = await signaling.getIce(code);
        const candidates = role === 'controller' ? display : controller;
        for (const raw of candidates) {
          try {
            await peer.addIceCandidate(JSON.parse(raw));
          } catch {}
        }
      } catch {}
      await sleep(pollIntervalMs);
    }
  }

  function waitForChannelOpen(ch) {
    return new Promise((resolve) => {
      if (ch.readyState === 'open') return resolve();
      ch.onopen = () => resolve();
    });
  }

  function waitForIncomingChannel(p) {
    return new Promise((resolve) => {
      p.ondatachannel = (e) => resolve(e.channel);
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function flushPending() {
    if (!pendingState || !channel || channel.readyState !== 'open') return;
    channel.send(JSON.stringify(pendingState));
    pendingState = null;
    lastSendAt = Date.now();
  }

  return {
    connect(roomCode, r) {
      return r === 'controller'
        ? connectController(roomCode)
        : connectDisplay(roomCode);
    },

    sendState(state) {
      pendingState = state;
      const now = Date.now();
      const elapsed = now - lastSendAt;
      if (elapsed >= THROTTLE_MS) {
        flushPending();
      } else if (!pendingTimer) {
        pendingTimer = setTimeout(() => {
          pendingTimer = null;
          flushPending();
        }, THROTTLE_MS - elapsed);
      }
    },

    onState(cb) { stateListeners.add(cb); },
    onStatusChange(cb) { statusListeners.add(cb); cb(status); },

    disconnect() {
      try { channel?.close(); } catch {}
      try { peer?.close(); } catch {}
      if (code) signaling.destroy(code).catch(() => {});
      setStatus('disconnected');
    },

    getStatus() { return status; },
  };
}
