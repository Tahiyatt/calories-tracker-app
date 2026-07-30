import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';

const env = loadEnv();
const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
  console.log(`[server] health check: http://localhost:${env.port}/api/health`);
});

// Deliberately not awaited: the HTTP server comes up regardless so that
// /api/health can tell you the database is the thing that's broken.
connectDb();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log(`\n[server] ${signal} received, shutting down`);
    server.close();
    await disconnectDb();
    process.exit(0);
  });
}
