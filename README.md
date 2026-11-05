# LightChatINAPP

LightChat uses React for the video-call UI, Express for authentication and meeting validation, Socket.IO for room presence and WebRTC signaling, and WebRTC for direct audio/video media.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The dev command starts Vite and the Express + Socket.IO server together. To create a production build, run `npm run build`; `npm start` serves the generated `dist` app, REST API, and Socket.IO endpoint on port 3000.

Create an account or sign in first. The server stores salted scrypt password hashes and issues an HttpOnly session cookie; Sign out ends the session and current call. Account records are stored in the local `data/users.json` file, while each account's scheduled meetings stay in that browser's local storage.

Start a call to create a meeting ID and six-digit passcode via Express. Share the invite link and passcode with guests. The invite link opens a form with the meeting ID prefilled; guests sign in, enter the passcode, and Join connects to the already-running server. Express validates the session and passcode before asking for camera/microphone access. Allow device access in each browser.

## Call flow

1. The host creates a meeting through Express; the server keeps its passcode hash and host account ID.
2. Invitees submit the meeting ID and passcode. Express validates the invite, then authenticated browsers join the Socket.IO room. Up to four participants are admitted.
3. Socket.IO relays targeted SDP offers/answers and ICE candidates between browsers and broadcasts presence/chat events. It does not carry media.
4. Each browser captures audio/video with `getUserMedia()` and negotiates `RTCPeerConnection` connections. Media flows directly peer-to-peer when possible.

Google's public STUN endpoint is configured by default; override it with `STUN_URL`. Some NATs/firewalls require a TURN relay. Set `TURN_URL` and `TURN_SECRET` to a coturn REST secret; Express issues one-hour, user-scoped TURN credentials through the authenticated `/api/ice-config` endpoint. Do not put TURN secrets in `VITE_*` variables or the browser bundle. P2P upload bandwidth grows with room size, so for larger calls use an SFU instead of this requested direct-media design. Remote invitees need a public HTTPS deployment so the app is reachable, Socket.IO uses a secure transport, and browsers permit camera/microphone access. `127.0.0.1` is local development only. Meeting metadata and sessions are currently in memory and disappear when the server restarts; user password hashes are stored in `data/users.json`.