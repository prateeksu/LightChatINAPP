require("dotenv").config();

const express = require("express");
const http = require("node:http");
const fs = require("node:fs");
const mysql = require("mysql2/promise");
const { Server } = require("socket.io");
const { createHash, createHmac, randomBytes, randomUUID, scrypt: scryptCallback, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");

const app = express();
const httpServer = http.createServer(app);
const allowedOrigins = new Set((process.env.FRONTEND_ORIGINS || "https://lightchat.in,http://127.0.0.1:5173,http://localhost:5173")
    .split(",").map((origin) => origin.trim()).filter(Boolean));
const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
        credentials: true,
    },
    maxHttpBufferSize: 64 * 1024,
});
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const path = require("node:path");
const USER_DATA_FILE = path.join(__dirname, "data", "users.json");
const SESSION_COOKIE = "lightchat_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_PARTICIPANTS = 4;
const scrypt = promisify(scryptCallback);
const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
});
const users = new Map();
const sessions = new Map();
const meetings = new Map();
const roomMembers = new Map();
const directMessages = new Map();
const directMembers = new Map();
const groups = new Map();

async function initializeDatabase() {
    const requiredSettings = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
    const missingSettings = requiredSettings.filter((setting) => !process.env[setting]);
    if (missingSettings.length) {
        throw new Error(`Missing database environment settings: ${missingSettings.join(", ")}`);
    }

    await dbPool.execute(`CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        name VARCHAR(48) NOT NULL,
        email VARCHAR(254) NOT NULL UNIQUE,
        salt CHAR(32) NOT NULL,
        password_hash CHAR(128) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    try {
        const legacyUsers = JSON.parse(await fs.promises.readFile(USER_DATA_FILE, "utf8"));
        for (const user of legacyUsers) {
            await dbPool.execute(
                "INSERT IGNORE INTO users (id, name, email, salt, password_hash) VALUES (?, ?, ?, ?, ?)",
                [user.id, user.name, user.email, user.salt, user.passwordHash],
            );
        }
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }

    const [storedUsers] = await dbPool.execute(
        "SELECT id, name, email, salt, password_hash AS passwordHash FROM users",
    );
    for (const user of storedUsers) users.set(user.email, user);
}

app.disable("x-powered-by");
app.use(express.json({ limit: "8kb" }));
app.use((request, response, next) => {
    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.setHeader("Vary", "Origin");
    }
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "OPTIONS") return response.sendStatus(204);
    next();
});

function getSessionToken(request) {
    const cookie = (request.headers.cookie || "").split(";").map((part) => part.trim())
        .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    return cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : null;
}

function getSession(request) {
    const token = getSessionToken(request);
    const session = token && sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }
    return session.user;
}

function requireAuth(request, response, next) {
    const user = getSession(request);
    if (!user) return response.status(401).json({ error: "Please sign in first." });
    request.user = user;
    next();
}

function cookieValue(request, token, maxAge) {
    const secure = request.socket.encrypted || process.env.NODE_ENV === "production";
    const sameSite = secure ? "None" : "Lax";
    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function publicUser(user) {
    return { id: user.id, name: user.name, email: user.email };
}

function validCredentials(email, password) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        && typeof password === "string" && password.length >= 8 && password.length <= 200;
}

app.get("/api/auth/session", (request, response) => {
    response.json({ user: getSession(request) });
});

app.get("/api/people", requireAuth, (request, response) => {
    response.json({ people: [...users.values()].filter((user) => user.id !== request.user.id).map(publicUser) });
});

app.get("/api/groups", requireAuth, (request, response) => {
    response.json({ groups: [...groups.values()].filter((group) => group.memberIds.includes(request.user.id)) });
});

app.post("/api/groups", requireAuth, (request, response) => {
    const name = typeof request.body.name === "string" ? request.body.name.trim() : "";
    const requestedIds = Array.isArray(request.body.memberIds) ? request.body.memberIds : [];
    const memberIds = [...new Set([request.user.id, ...requestedIds.filter((id) => typeof id === "string")])];
    if (!name || name.length > 64 || memberIds.length < 2 || memberIds.length > MAX_PARTICIPANTS
        || memberIds.some((id) => ![...users.values()].some((user) => user.id === id))) {
        return response.status(400).json({ error: `Enter a group name and choose 1 to ${MAX_PARTICIPANTS - 1} other people.` });
    }
    const group = {
        id: randomUUID(),
        type: "group",
        name,
        memberIds,
        members: memberIds.map((id) => publicUser([...users.values()].find((user) => user.id === id))),
        createdBy: request.user.id,
    };
    groups.set(group.id, group);
    response.status(201).json({ group });
});

app.get("/api/ice-config", requireAuth, (request, response) => {
    const iceServers = [{ urls: process.env.STUN_URL || "stun:stun.l.google.com:19302" }];
    if (process.env.TURN_URL && process.env.TURN_SECRET) {
        const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
        const username = `${expiresAt}:${request.user.id}`;
        const credential = createHmac("sha1", process.env.TURN_SECRET).update(username).digest("base64");
        iceServers.push({
            urls: process.env.TURN_URL.split(",").map((url) => url.trim()),
            username,
            credential,
        });
    }
    response.json({ iceServers });
});

app.post("/api/auth/register", async (request, response) => {
    const name = typeof request.body.name === "string" ? request.body.name.trim() : "";
    const email = typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
    const password = request.body.password;
    if (!name || name.length > 48 || !validCredentials(email, password)) {
        return response.status(400).json({ error: "Enter your name, a valid email, and a password of at least 8 characters." });
    }
    const salt = randomBytes(16);
    const passwordHash = await scrypt(password, salt, 64);
    const user = { id: randomUUID(), name, email, salt: salt.toString("hex"), passwordHash: passwordHash.toString("hex") };
    try {
        await dbPool.execute(
            "INSERT INTO users (id, name, email, salt, password_hash) VALUES (?, ?, ?, ?, ?)",
            [user.id, user.name, user.email, user.salt, user.passwordHash],
        );
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return response.status(409).json({ error: "An account with this email already exists." });
        }
        throw error;
    }
    users.set(email, user);
    const token = randomBytes(32).toString("base64url");
    sessions.set(token, { user: publicUser(user), expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
    response.setHeader("Set-Cookie", cookieValue(request, token, SESSION_TTL_SECONDS));
    response.status(201).json({ user: publicUser(user) });
});

app.post("/api/auth/login", async (request, response) => {
    const email = typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
    const password = request.body.password;
    if (!validCredentials(email, password)) return response.status(400).json({ error: "Enter a valid email and password." });
    const [storedUsers] = await dbPool.execute(
        "SELECT id, name, email, salt, password_hash AS passwordHash FROM users WHERE email = ? LIMIT 1",
        [email],
    );
    const user = storedUsers[0];
    if (!user) return response.status(401).json({ error: "Email or password is incorrect." });
    const candidate = await scrypt(password, Buffer.from(user.salt, "hex"), 64);
    const expected = Buffer.from(user.passwordHash, "hex");
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
        return response.status(401).json({ error: "Email or password is incorrect." });
    }
    const token = randomBytes(32).toString("base64url");
    sessions.set(token, { user: publicUser(user), expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
    response.setHeader("Set-Cookie", cookieValue(request, token, SESSION_TTL_SECONDS));
    response.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (request, response) => {
    const token = getSessionToken(request);
    if (token) sessions.delete(token);
    response.setHeader("Set-Cookie", cookieValue(request, "", 0));
    response.json({ ok: true });
});

function makeRoomId() {
    return `room-${randomUUID()}`;
}

function makePasscode() {
    return String(randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, "0");
}

function digestPasscode(passcode) {
    return createHash("sha256").update(passcode).digest();
}

function hasValidPasscode(meeting, passcode) {
    if (!meeting || typeof passcode !== "string" || !/^\d{6}$/.test(passcode)) return false;
    return timingSafeEqual(meeting.passcodeHash, digestPasscode(passcode));
}

app.post("/api/meetings", requireAuth, (request, response) => {
    const body = request.body || {};
    const recipientId = typeof body.recipientId === "string" ? body.recipientId : null;
    const recipient = recipientId ? [...users.values()].find((user) => user.id === recipientId) : null;
    const recipientIds = Array.isArray(body.recipientIds) ? [...new Set(body.recipientIds)] : [];
    const guestIds = recipient ? [recipient.id] : recipientIds;
    if ((recipientId && (!recipient || recipient.id === request.user.id))
        || guestIds.length > MAX_PARTICIPANTS - 1
        || guestIds.includes(request.user.id)
        || guestIds.some((id) => ![...users.values()].some((user) => user.id === id))) {
        return response.status(400).json({ error: `Choose up to ${MAX_PARTICIPANTS - 1} valid people to invite.` });
    }
    const roomId = makeRoomId();
    const passcode = makePasscode();
    meetings.set(roomId, {
        roomId,
        passcodeHash: digestPasscode(passcode),
        hostId: request.user.id,
        hostName: request.user.name,
        guestIds,
    });
    response.status(201).json({ roomId, passcode, hostName: request.user.name });
});

app.post("/api/meetings/:roomId/validate", requireAuth, (request, response) => {
    const meeting = meetings.get(request.params.roomId);
    if (!hasValidPasscode(meeting, request.body.passcode)
        || (meeting.hostId !== request.user.id && !meeting.guestIds?.includes(request.user.id))) {
        return response.status(403).json({ error: "Meeting ID or passcode is incorrect, or the host has not started the meeting." });
    }
    response.json({ roomId: meeting.roomId, hostName: meeting.hostName });
});

function socketSession(request) {
    const cookie = (request.headers.cookie || "").split(";").map((part) => part.trim())
        .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    if (!cookie) return null;
    const token = decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1));
    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) return null;
    return session.user;
}

io.use((socket, next) => {
    const user = socketSession(socket.request);
    if (!user) return next(new Error("Authentication required."));
    socket.user = user;
    next();
});

function leaveMeeting(socket) {
    const roomId = socket.meetingId;
    if (!roomId) return;
    const members = roomMembers.get(roomId);
    members?.delete(socket.id);
    socket.leave(roomId);
    socket.meetingId = null;
    if (members?.size === 0) roomMembers.delete(roomId);
    socket.to(roomId).emit("meeting:peer-left", { peerId: socket.id, participantCount: members?.size || 0 });
    io.to(roomId).emit("meeting:presence", { participantCount: members?.size || 0 });
}

function directRoomId(firstUserId, secondUserId) {
    return `direct:${[firstUserId, secondUserId].sort().join(":")}`;
}

function leaveDirect(socket) {
    const roomId = socket.directRoomId;
    if (!roomId) return;
    const members = directMembers.get(roomId);
    members?.delete(socket.id);
    socket.leave(roomId);
    socket.directRoomId = null;
    socket.directPeerId = null;
    if (members?.size === 0) directMembers.delete(roomId);
}

function appendDirectMessage(roomId, message) {
    const history = directMessages.get(roomId) || [];
    history.push(message);
    if (history.length > 500) history.splice(0, history.length - 500);
    directMessages.set(roomId, history);
    io.to(roomId).emit("direct:message", message);
    return message;
}

io.on("connection", (socket) => {
    socket.directRoomId = null;

    socket.on("direct:join", async ({ peerId, groupId } = {}, acknowledge = () => { }) => {
        const recipient = peerId ? [...users.values()].find((user) => user.id === peerId) : null;
        const group = groupId ? groups.get(groupId) : null;
        if ((!recipient && !group) || (recipient && recipient.id === socket.user.id)
            || (group && !group.memberIds.includes(socket.user.id))) {
            acknowledge({ ok: false, error: "This conversation is not available to your account." });
            return;
        }
        if (socket.directRoomId) {
            leaveDirect(socket);
        }
        const roomId = group ? `group:${group.id}` : directRoomId(socket.user.id, recipient.id);
        const members = directMembers.get(roomId) || new Set();
        members.add(socket.id);
        directMembers.set(roomId, members);
        socket.directRoomId = roomId;
        socket.directPeerId = recipient?.id || null;
        socket.directGroupId = group?.id || null;
        await socket.join(roomId);
        acknowledge({
            ok: true,
            conversationId: group?.id || recipient.id,
            type: group ? "group" : "direct",
            roomId,
            name: group?.name || recipient.name,
            members: group?.members || [publicUser(recipient)],
            messages: directMessages.get(roomId) || [],
        });
    });

    socket.on("direct:send", ({ peerId, groupId, text } = {}, acknowledge = () => { }) => {
        const recipient = peerId ? [...users.values()].find((user) => user.id === peerId) : null;
        const group = groupId ? groups.get(groupId) : null;
        const roomId = group ? `group:${group.id}` : recipient ? directRoomId(socket.user.id, recipient.id) : null;
        if ((!recipient && !group) || (recipient && recipient.id === socket.user.id)
            || (group && !group.memberIds.includes(socket.user.id))
            || typeof text !== "string" || !text.trim() || text.length > 2000) {
            acknowledge({ ok: false, error: "Enter a message up to 2000 characters." });
            return;
        }
        if (socket.directRoomId !== roomId) {
            acknowledge({ ok: false, error: "Open this conversation before sending a message." });
            return;
        }
        const message = {
            id: randomUUID(),
            type: "text",
            conversationKey: roomId,
            text: text.trim(),
            sender: publicUser(socket.user),
            sentAt: new Date().toISOString(),
        };
        appendDirectMessage(roomId, message);
        acknowledge({ ok: true, message });
    });

    socket.on("direct:call-event", ({ peerId, groupId, roomId, passcode, url } = {}, acknowledge = () => { }) => {
        const recipient = peerId ? [...users.values()].find((user) => user.id === peerId) : null;
        const group = groupId ? groups.get(groupId) : null;
        const meeting = meetings.get(roomId);
        const conversationRoom = group ? `group:${group.id}` : recipient ? directRoomId(socket.user.id, recipient.id) : null;
        const validMembers = group
            ? meeting?.hostId === socket.user.id && meeting.guestIds?.length === group.memberIds.filter((id) => id !== socket.user.id).length
            && group.memberIds.every((id) => meeting.hostId === id || meeting.guestIds.includes(id))
            : recipient && meeting?.hostId === socket.user.id && meeting.guestIds?.includes(recipient.id);
        if ((!recipient && !group) || !meeting || !validMembers
            || socket.directRoomId !== conversationRoom || !hasValidPasscode(meeting, passcode)
            || typeof url !== "string" || url.length > 2000) {
            acknowledge({ ok: false, error: "Could not log this call in the conversation." });
            return;
        }
        const message = {
            id: randomUUID(),
            type: "call",
            conversationKey: conversationRoom,
            text: `${socket.user.name} started a video call.`,
            roomId,
            passcode,
            url,
            sender: publicUser(socket.user),
            sentAt: new Date().toISOString(),
        };
        appendDirectMessage(conversationRoom, message);
        acknowledge({ ok: true, message });
    });

    socket.on("meeting:join", ({ roomId, passcode } = {}, acknowledge = () => { }) => {
        if (socket.meetingId) leaveMeeting(socket);
        const meeting = meetings.get(roomId);
        if (!hasValidPasscode(meeting, passcode)
            || (meeting.hostId !== socket.user.id && !meeting.guestIds?.includes(socket.user.id))) {
            acknowledge({ ok: false, error: "Meeting ID or passcode is incorrect, or the host has not started the meeting." });
            return;
        }
        const members = roomMembers.get(roomId) || new Set();
        if (members.size >= MAX_PARTICIPANTS) {
            acknowledge({ ok: false, error: `This meeting is full. Maximum ${MAX_PARTICIPANTS} participants.` });
            return;
        }

        members.add(socket.id);
        roomMembers.set(roomId, members);
        socket.meetingId = roomId;
        socket.join(roomId);
        acknowledge({
            ok: true,
            peerId: socket.id,
            peers: [...members].filter((peerId) => peerId !== socket.id),
            isHost: meeting.hostId === socket.user.id,
            hostName: meeting.hostName,
            user: publicUser(socket.user),
            participantCount: members.size,
            maxParticipants: MAX_PARTICIPANTS,
        });
        socket.to(roomId).emit("meeting:peer-joined", { peerId: socket.id, user: publicUser(socket.user), participantCount: members.size });
        io.to(roomId).emit("meeting:presence", { participantCount: members.size });
    });

    socket.on("meeting:signal", ({ target, data } = {}, acknowledge = () => { }) => {
        if (!socket.meetingId || typeof target !== "string" || !data || typeof data !== "object") {
            acknowledge({ ok: false, error: "Invalid signaling message." });
            return;
        }
        if (JSON.stringify(data).length > 48_000) {
            acknowledge({ ok: false, error: "Signaling message is too large." });
            return;
        }
        const members = roomMembers.get(socket.meetingId);
        if (!members?.has(target)) {
            acknowledge({ ok: false, error: "That participant is not in this meeting." });
            return;
        }
        io.to(target).emit("meeting:signal", { from: socket.id, data });
        acknowledge({ ok: true });
    });

    socket.on("meeting:chat", ({ text } = {}, acknowledge = () => { }) => {
        if (!socket.meetingId || typeof text !== "string" || !text.trim() || text.length > 1000) {
            acknowledge({ ok: false, error: "Enter a message up to 1000 characters." });
            return;
        }
        io.to(socket.meetingId).emit("meeting:chat-message", {
            id: randomUUID(),
            text: text.trim(),
            user: publicUser(socket.user),
            sentAt: new Date().toISOString(),
        });
        acknowledge({ ok: true });
    });

    socket.on("meeting:leave", () => leaveMeeting(socket));
    socket.on("disconnect", () => {
        leaveMeeting(socket);
        leaveDirect(socket);
    });
});

async function startServer() {
    try {
        await initializeDatabase();
        httpServer.listen(PORT, HOST, () => {
            console.log(`LightChat API + Socket.IO listening on http://${HOST}:${PORT}`);
        });
    } catch (error) {
        console.error("Could not initialize the LightChat database:", error.message);
        await dbPool.end();
        process.exitCode = 1;
    }
}

startServer();
