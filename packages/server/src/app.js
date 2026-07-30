import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { loadEnv } from './config/env.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import entriesRouter from './routes/entries.js';
import foodsRouter from './routes/foods.js';
import goalsRouter from './routes/goals.js';
import weightsRouter from './routes/weights.js';
import { requireAuth } from './middleware/requireAuth.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const env = loadEnv();
  const app = express();

  // credentials:true is required for the browser to send the httpOnly refresh
  // cookie cross-origin. In development Vite proxies /api, so this matters once
  // the web app is deployed to a different origin, and for React Native later.
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);

  // requireAuth mounted here rather than per-route: every entry, goal and
  // weight is owned by a user, so there is no unauthenticated path worth
  // leaving open by accident.
  app.use('/api/foods', requireAuth, foodsRouter);
  app.use('/api/entries', requireAuth, entriesRouter);
  app.use('/api/goals', requireAuth, goalsRouter);
  app.use('/api/weights', requireAuth, weightsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
