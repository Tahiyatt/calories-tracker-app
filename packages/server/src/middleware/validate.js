/**
 * Runs a Zod schema against part of the request and REPLACES that part with the
 * parsed result. Replacing rather than merely checking is the point: downstream
 * handlers then receive coerced, trimmed, defaulted values, so there is exactly
 * one representation of the input in the codebase.
 *
 * Parse failures throw ZodError, which the error handler turns into a 400.
 */
export const validateBody = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body);
  next();
};

export const validateQuery = (schema) => (req, res, next) => {
  req.validatedQuery = schema.parse(req.query);
  next();
};

export const validateParams = (schema) => (req, res, next) => {
  req.params = schema.parse(req.params);
  next();
};
