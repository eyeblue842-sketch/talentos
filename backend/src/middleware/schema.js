import { ZodError } from 'zod';
import { apiError } from '../utils/response.js';

export function validateSchema(schema, target = 'body') {
  return (req, res, next) => {
    try {
      req[target] = schema.parse(req[target]);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(422).json(apiError('Validation failed.', error.flatten()));
      }
      return next(error);
    }
  };
}
