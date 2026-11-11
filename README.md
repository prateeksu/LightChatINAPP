# FirstYourHealth PhoneChat — React + Express + MySQL + WebSocket + Redis

A GitHub-ready starter with separate React, REST API, and WebSocket services.

## Architecture
- `client/`: React + Vite
- `api/`: Express REST API (login, search users, chat history)
- `ws-server/`: WebSocket server for live messages
- MySQL: users and messages
- Redis Pub/Sub: fan-out between WebSocket instances (local Docker Compose)

> This is a starter, not production-ready authentication. Before production, add OTP verification, rate limits, HTTPS/WSS, secure password hashing, refresh/session management, authorization checks, validation, and logging.

## Local prerequisites
Node.js 20+, Docker Desktop (for MySQL/Redis), Git.

## Start databases
From project root:
```bash
docker compose up -d mysql redis
```

## Configure environment
```bash
cp api/.env.example api/.env
cp ws-server/.env.example ws-server/.env
cp client/.env.example client/.env
```
Update secrets in both server env files. Keep `.env` out of Git.

## Install
```bash
cd api && npm install
cd ../ws-server && npm install
cd ../client && npm install
```

## Initialize schema and demo accounts
```bash
cd api
npm run db:init
npm run db:seed
```
Demo users:
- `+919876543210` / `demo123`
- `+919876543211` / `demo123`

## Run (3 terminals)
```bash
# terminal 1
cd api && npm run dev

# terminal 2
cd ws-server && npm run dev

# terminal 3
cd client && npm run dev
```
Open http://localhost:5173

## GitHub
```bash
git init
git add .
git commit -m "Initial FirstYourHealth PhoneChat"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/firsturhealth-phonechat.git
git push -u origin main
```

## Deployment notes
- Deploy React static build (`client/dist`) to your frontend domain.
- Deploy Express API to a Node hosting service and set `CLIENT_ORIGIN`, `DATABASE_URL` or MySQL fields.
- Deploy WebSocket service to a host that explicitly supports inbound WebSocket/WSS.
- Redis must be reachable by both API/WS services; use managed Redis or a VPS.
- Hostinger Cloud managed Node hosting may not expose the infrastructure needed to run a Redis server and dedicated WebSocket listener. Confirm your plan's supported ports/features; use external services or a VPS for WS/Redis.
- Set production `VITE_API_URL` and `VITE_WS_URL` to HTTPS/WSS endpoints before building.
