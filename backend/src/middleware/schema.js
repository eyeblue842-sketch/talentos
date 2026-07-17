import { ZodError } from 'zod';
import { apiError } from '../utils/response.js';

export function validateSchema(schema, target = 'body') {
  return (req, res, next) => {
    try {
      req[target] = schema.parse(req[target]);
      next();
    } catch (error) {
      const isZodError = error instanceof ZodError || error?.name === 'ZodError' || Array.isArray(error?.issues);
      if (isZodError) {
        const flattened = typeof error.flatten === 'function'
          ? error.flatten()
          : {
              formErrors: [],
              fieldErrors: Object.fromEntries((error.issues || []).map((issue) => [issue.path?.[0] || 'form', [issue.message]])),
            };
        return res.status(422).json(apiError('Validation failed.', flattened));
      }
      return next(error);
    }
  };
}
