import { validationResult } from 'express-validator';

export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  return res.status(422).json({
    success: false,
    message: 'Validation failed.',
    errors: result.array(),
  });
}
