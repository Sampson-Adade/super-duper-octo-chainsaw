import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { attachGameServer } from './index.js';

const app = express();
const configuredOrigins = process.env.CLIENT_URL?.split(',').map(origin => origin.trim()).filter(Boolean);
const allowedOrigin = configuredOrigins?.includes('*') ? '*' : configuredOrigins?.length ? configuredOrigins : true;
app.use(cors({ origin: allowedOrigin }));
app.get('/health', (_, res) => res.json({ ok: true, service: 'glitch-server' }));
const http = createServer(app);
const io = new Server(http, { cors: { origin: allowedOrigin } });
attachGameServer(io);

const port = Number(process.env.SOCKET_PORT) || Number(process.env.PORT) || 3001;
http.listen(port, '0.0.0.0', () => console.log(`Glitch server listening on :${port}`));
