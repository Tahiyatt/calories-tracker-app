import { Router } from 'express';
import { dbStatus } from '../config/db.js';

const router = Router();

/**
 * Liveness: is the process up? Always 200 if it can answer at all.
 *
 * Separate from readiness on purpose. Pointing a platform health check at the
 * readiness endpoint would make it restart the service in a loop whenever the
 * database is unreachable — burying the log line that says why.
 */
router.get('/health/live', (req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.round(process.uptime()) });
});

/** Readiness: can it actually serve requests? 503 when the database is down. */
router.get('/health', (req, res) => {
  const db = dbStatus();
  res.status(db === 'connected' ? 200 : 503).json({
    ok: db === 'connected',
    db,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
