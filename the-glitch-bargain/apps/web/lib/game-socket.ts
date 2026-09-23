import { io as socketIo } from 'socket.io-client';

type Listener = (...args: any[]) => void;
type PendingAck = { callback: Listener; timer: ReturnType<typeof setTimeout>; timeoutStyle: boolean };

export class GameSocket {
  connected = false;
  private ws: WebSocket | null = null;
  private manuallyClosed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 500;
  private ackTimeoutMs = 8000;
  private timeoutStyleNext = false;
  private localSocket: any = null;
  private nextAckId = 0;
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly onceListeners = new Map<string, Set<Listener>>();
  private readonly pending = new Map<string, PendingAck>();

  on(event: string, listener: Listener) {
    const set = this.listeners.get(event) || new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);
    return this;
  }

  once(event: string, listener: Listener) {
    const set = this.onceListeners.get(event) || new Set<Listener>();
    set.add(listener);
    this.onceListeners.set(event, set);
    return this;
  }

  private dispatch(event: string, ...args: any[]) {
    for (const listener of this.listeners.get(event) || []) listener(...args);
    const once = this.onceListeners.get(event);
    if (once) {
      this.onceListeners.delete(event);
      for (const listener of once) listener(...args);
    }
  }

  connect() {
    if (this.connected || this.ws) return this;
    this.manuallyClosed = false;
    if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const connection = socketIo(window.location.origin, {
        path: '/socket.io', autoConnect: false, timeout: 5000, transports: ['websocket'],
      });
      this.localSocket = connection;
      connection.on('connect', () => { this.connected = true; this.dispatch('connect'); });
      connection.on('disconnect', () => { this.connected = false; this.dispatch('disconnect'); });
      connection.on('connect_error', (error: any) => this.dispatch('connect_error', error));
      connection.onAny((event: string, ...args: any[]) => this.dispatch(event, ...args));
      connection.connect();
      return this;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    this.ws = ws;
    ws.addEventListener('message', (message) => {
      if (typeof message.data !== 'string') return;
      let frame: any;
      try { frame = JSON.parse(message.data); } catch { return; }
      if (frame?.type === 'connect') {
        this.connected = true;
        this.retryDelay = 500;
        this.dispatch('connect');
      } else if (frame?.type === 'event' && typeof frame.event === 'string') {
        this.dispatch(frame.event, frame.data);
      } else if (frame?.type === 'ack' && typeof frame.id === 'string') {
        const pending = this.pending.get(frame.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(frame.id);
        if (pending.timeoutStyle) pending.callback(null, frame.result);
        else pending.callback(frame.result);
      }
    });
    ws.addEventListener('error', () => {
      this.dispatch('connect_error', { message: 'The game server connection failed.' });
    });
    ws.addEventListener('close', () => {
      this.connected = false;
      this.ws = null;
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timer);
        if (pending.timeoutStyle) pending.callback(new Error('The game server disconnected.'), undefined);
        else pending.callback({ ok: false, error: 'The game server disconnected. Try again.' });
        this.pending.delete(id);
      }
      this.dispatch('disconnect');
      if (!this.manuallyClosed) {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), this.retryDelay);
        this.retryDelay = Math.min(10_000, this.retryDelay * 1.7);
      }
    });
    return this;
  }

  timeout(milliseconds: number) {
    this.ackTimeoutMs = milliseconds;
    this.timeoutStyleNext = true;
    return this;
  }

  emit(event: string, data: unknown = {}, callback?: Listener) {
    const timeoutStyle = this.timeoutStyleNext;
    const timeoutMs = this.ackTimeoutMs;
    this.ackTimeoutMs = 8000;
    this.timeoutStyleNext = false;
    if (this.localSocket) {
      if (timeoutStyle) this.localSocket.timeout(timeoutMs).emit(event, data, callback);
      else this.localSocket.emit(event, data, callback);
      return this;
    }
    const id = callback ? `${Date.now().toString(36)}-${++this.nextAckId}` : undefined;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connected) {
      if (callback) {
        const result = { ok: false, error: 'The game server is reconnecting. Please try again.' };
        if (timeoutStyle) callback(new Error(result.error), undefined);
        else callback(result);
      }
      return this;
    }
    if (id && callback) {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        if (timeoutStyle) callback(new Error('The game server did not respond.'), undefined);
        else callback({ ok: false, error: 'The game server did not respond. Please try again.' });
      }, timeoutMs);
      this.pending.set(id, { callback, timer, timeoutStyle });
    }
    this.ws.send(JSON.stringify({ type: 'emit', event, data, ...(id ? { id } : {}) }));
    return this;
  }

  disconnect() {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.localSocket?.disconnect();
    this.localSocket = null;
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    return this;
  }
}
