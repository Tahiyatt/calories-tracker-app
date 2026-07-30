import { ZodError } from 'zod';

/** 404 for anything that fell through the routers. */
export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

/**
 * Express 5 forwards rejected promises from async handlers here automatically,
 * so route handlers can just throw instead of wrapping everything in try/catch.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  // Duplicate key: a unique index rejected the write.
  if (err?.code === 11000) {
    return res.status(409).json({
      error: 'That record already exists',
      fields: Object.keys(err.keyPattern ?? {}),
    });
  }

  const status = err.status ?? 500;
  if (status >= 500) console.error('[error]', err);

  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
  });
}
