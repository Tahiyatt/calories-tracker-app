import mongoose from 'mongoose';
import { loadEnv } from './env.js';

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/**
 * Connect to MongoDB without blocking server startup, so /api/health can
 * report which half is broken. A skeleton that dies silently on a bad
 * connection string is much harder to debug than one that tells you.
 */
export async function connectDb() {
  const { mongoUri } = loadEnv();

  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
  mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log(`[db] connected to ${mongoose.connection.name}`);
  } catch (err) {
    console.error(`[db] connection failed: ${err.message}`);
  }
}

export function dbStatus() {
  return READY_STATES[mongoose.connection.readyState] ?? 'unknown';
}

export async function disconnectDb() {
  await mongoose.connection.close();
}
