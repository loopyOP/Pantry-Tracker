import { io, Socket } from 'socket.io-client';
import { host } from '@/host.js';

let socket: Socket | null = null;
let currentToken: string | null = null;

export type ProductsChangedPayload = {
  type: 'upsert' | 'delete';
  product?: any; // camelCase fields when type === 'upsert'
  barcode?: string;
  id?: number;
};

export function connectRealtime(token: string, onProductsChanged: (payload: ProductsChangedPayload) => void) {
  if (socket && currentToken === token) return socket;
  disconnectRealtime();
  currentToken = token;

  socket = io(host, {
    transports: ['websocket'],
    withCredentials: true,
    auth: { token: token.startsWith('Bearer ') ? token : `Bearer ${token}` },
  });

  socket.on('connect', () => {
    // console.log('Realtime connected');
  });

  socket.on('connect_error', (err) => {
    console.log('Realtime connect error', err?.message);
  });

  socket.on('products:changed', (payload: ProductsChangedPayload) => {
    try {
      onProductsChanged(payload);
    } catch (e) {
      console.log('Realtime handler error', e);
    }
  });

  return socket;
}

export function disconnectRealtime() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
