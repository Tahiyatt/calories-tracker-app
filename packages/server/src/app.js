import express from 'express';
import cors from 'cors';

import healthRouter from './routes/health.js';
// import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // In development the Vite dev server proxies /api, so CORS isn't hit at all.
  // It matters once the web app is deployed to a different origin, and again
  // for the React Native client in Phase 6.
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '100kb' }));

  app.use('/api', healthRouter);

  // Routers land here as Phase 1 progresses:
  // app.use('/api/auth', authRouter);
  // app.use('/api/entries', requireAuth, foodEntryRouter);
  // app.use('/api/goals', requireAuth, goalRouter);
  // app.use('/api/weights', requireAuth, weightLogRouter);

//   app.use(notFound);
//   app.use(errorHandler);

  return app;
}
