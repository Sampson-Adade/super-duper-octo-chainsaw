import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import WebSocket, { type RawData } from 'ws';
import {
  attachGameServer,
  configureRoomPersistence,
  warmGameRoom,
} from '@glitch/server';

const REDIS_URL = process.env.REDIS_URL;
const CHANNEL = 'glitch:live-events:v1';
const ROOM_TTL_SECONDS = 60 * 60 * 24;
const INSTANCE_ID = randomUUID();
const redis = REDIS_URL
  ? new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: null, enableReadyCheck: false })
  : null;
const localSockets = new Map<string, RuntimeSocket>();
let acceptConnection: ((socket: RuntimeSocket) => void) | null = null;
const localLocks = new Map<string, Promise<unknown>>();

function serialize(frame: unknown) {
  return JSON.stringify(frame);
}

function sendSocket(socket: RuntimeSocket, frame: unknown) {
  if (socket.readyState === WebSocket.OPEN) socket.send(serialize(frame));
}

function deliver(target: string, event: string, data: unknown) {
  for (const socket of localSockets.values()) {
    if (socket.id === target || socket.rooms.has(target)) socket.sendEvent(event, data);
  }
}

async function publish(target: string, event: string, data: unknown) {
  deliver(target, event, data);
  if (!redis) return;
  await redis.publish(CHANNEL, serialize({ origin: INSTANCE_ID, target, event, data }));
}

if (redis) {
  const subscriber = redis.duplicate();
  subscriber.on('message', (_channel, raw) => {
    try {
      const message = JSON.parse(raw);
      if (message.origin === INSTANCE_ID || typeof message.target !== 'string' || typeof message.event !== 'string') return;
      deliver(message.target, message.event, message.data);
      if (message.event === 'room:state' && typeof message.data?.code === 'string') {
        void warmGameRoom(message.data.code).catch((error) => console.error('Could not restore Vercel game timer:', error));
      }
    } catch (error) {
      console.error('Ignored malformed live game event:', error);
    }
  });
  void subscriber.subscribe(CHANNEL).catch((error) => console.error('Redis live-event subscription failed:', error));
}

async function withLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  if (!redis) {
    const previous = localLocks.get(key) || Promise.resolve();
    const current = previous.catch(() => undefined).then(action);
    localLocks.set(key, current);
    try { return await current; }
    finally { if (localLocks.get(key) === current) localLocks.delete(key); }
  }

  const lockKey = `glitch:lock:${key}`;
  const owner = randomUUID();
  const started = Date.now();
  while (Date.now() - started < 7000) {
    const claimed = await redis.set(lockKey, owner, 'PX', 15000, 'NX');
    if (claimed === 'OK') {
      try { return await action(); }
      finally {
        await redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          lockKey,
          owner,
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 35 + Math.floor(Math.random() * 30)));
  }
  throw new Error('The room is busy. Try that action again.');
}

configureRoomPersistence(redis ? {
  get: (code) => redis.get(`glitch:room:${code}`),
  set: async (code, value) => { await redis.set(`glitch:room:${code}`, value, 'EX', ROOM_TTL_SECONDS); },
  delete: async (code) => { await redis.del(`glitch:room:${code}`); },
  withLock,
} : null);

class RuntimeSocket {
  readonly id = randomUUID();
  readonly data: Record<string, any> = {};
  readonly rooms = new Set<string>([this.id]);
  readonly handlers = new Map<string, Array<(...args: any[]) => void>>();
  readyState: number;
  private readonly ws: WebSocket;
  private closed = false;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.readyState = ws.readyState;
    this.ws.on('open', () => { this.readyState = WebSocket.OPEN; });
  }

  on(event: string, handler: (...args: any[]) => void) {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  send(value: string) { this.ws.send(value); }

  dispatch(event: string, data?: unknown, callback?: (result: any) => void) {
    for (const handler of this.handlers.get(event) || []) handler(data, callback);
  }

  join(room: string) { this.rooms.add(room); }
  leave(room: string) { this.rooms.delete(room); }
  sendEvent(event: string, data: unknown) { sendSocket(this, { type: 'event', event, data }); }
  sendRaw(frame: unknown) { sendSocket(this, frame); }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.readyState = WebSocket.CLOSED;
    this.dispatch('disconnect');
    localSockets.delete(this.id);
  }
}

const io = {
  on(event: string, handler: (socket: RuntimeSocket) => void) {
    if (event === 'connection') acceptConnection = handler;
  },
  to(target: string) {
    return { emit: (event: string, data: unknown) => { void publish(target, event, data).catch((error) => console.error('Live game broadcast failed:', error)); } };
  },
  sockets: { sockets: localSockets },
};

attachGameServer(io);

function parseFrame(data: RawData) {
  const text = typeof data === 'string' ? data : data.toString();
  if (text.length > 16_384) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export function handleWebSocket(ws: WebSocket) {
  const socket = new RuntimeSocket(ws);
  localSockets.set(socket.id, socket);
  acceptConnection?.(socket);
  socket.sendRaw({ type: 'connect', id: socket.id });

  ws.on('message', (raw) => {
    const frame = parseFrame(raw);
    if (!frame || frame.type !== 'emit' || typeof frame.event !== 'string' || frame.event.length > 80) return;
    const acknowledge = typeof frame.id === 'string' && frame.id.length < 100
      ? (result: unknown) => socket.sendRaw({ type: 'ack', id: frame.id, result })
      : undefined;
    socket.dispatch(frame.event, frame.data && typeof frame.data === 'object' ? frame.data : {}, acknowledge);
  });

  ws.on('close', () => socket.close());
  ws.on('error', () => socket.close());
}
