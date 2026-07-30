import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';

const PORT = Number(process.env.PORT ?? 4000);

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] health check: http://localhost:${PORT}/api/health`);
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
