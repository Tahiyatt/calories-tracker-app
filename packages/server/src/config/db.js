import mongoose from 'mongoose';

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/**
 * Connect to MongoDB without blocking server startup.
 *
 * The server stays up even when Mongo is unreachable so /api/health can
 * report *which* half is broken. 
 */
export async function connectDb() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('[db] MONGODB_URI is not set — copy .env.example to .env at the repo root');
    return;
  }

  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
  mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
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
