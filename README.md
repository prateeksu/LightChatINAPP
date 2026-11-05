# LightChat

LightChat is organized as two independent projects:

- `frontend/`: React + Vite video chat, scheduling, direct messages, and group chats.
- `api/`: Express REST API and Socket.IO service for accounts, meetings, chat, and signaling.

## Run both locally

Requires Node.js 20 or newer.

```sh
npm run install:all
npm run dev
```

Open the frontend at `http://127.0.0.1:5173`. The API listens at `http://127.0.0.1:3000`. To run them independently, use `npm run dev --prefix api` and `npm run dev --prefix frontend` in separate terminals.

## Configure separately

Production domains are configured as `https://lightchat.in` for the frontend and `https://api.lightchat.in` for the API. Vite production builds read `VITE_API_URL=https://api.lightchat.in` from `frontend/.env.production`. Set `FRONTEND_ORIGINS=https://lightchat.in` in the API deployment environment (the checked-in `api/.env.example` also includes localhost origins for development). For local development, the frontend `.env.example` points at `http://127.0.0.1:3000`. Deploy the API with `NODE_ENV=production` so session cookies are `Secure` and cross-subdomain requests use `SameSite=None`. Use HTTPS for both domains and configure TURN when networks require media relaying.

Accounts, meetings, direct/group messages, and call events are handled by the API project. Password hashes are in `api/data/users.json`; meetings and chat history are currently in memory and reset when the API process restarts. Frontend schedules remain in that browser's local storage.

Video media uses peer-to-peer WebRTC; Socket.IO relays meeting metadata and SDP/ICE signaling, not media. One-to-one and up-to-four-person group conversations support text and joinable video-call events. Group video uses a peer mesh; use an SFU for larger rooms.