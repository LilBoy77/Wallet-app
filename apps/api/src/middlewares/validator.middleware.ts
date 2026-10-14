import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { type AnyZodObject, type ZodError } from 'zod';
import { ValidationError, type FieldErrorDetail } from '../shared/errors/app-error.js';

export interface ValidationSchemas {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

/**
 * Formats Zod validation issues into standardized field-level error details.
 */
export function formatZodIssues(error: ZodError): FieldErrorDetail[] {
  return error.issues.map((issue) => {
    const field = issue.path.join('.') || 'root';
    return {
      field,
      message: issue.message,
    };
  });
}

/**
 * Zod validation middleware for Express routes.
 * Validates request body, query, and params against provided Zod schemas.
 * Assigns stripped/parsed types to req.body, req.query, req.params.
 * Unknown fields are stripped by default (unless schema explicitly specifies .strict()).
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.params) {
        const parsedParams = await schemas.params.parseAsync(req.params);
        req.params = parsedParams as Record<string, string>;
      }

      if (schemas.query) {
        const parsedQuery = await schemas.query.parseAsync(req.query);
        req.query = parsedQuery as Request['query'];
      }

      if (schemas.body) {
        const parsedBody = await schemas.body.parseAsync(req.body);
        req.body = parsedBody;
      }

      next();
    } catch (error) {
      if ((error as ZodError).name === 'ZodError') {
        const fieldDetails = formatZodIssues(error as ZodError);
        return next(new ValidationError('Input yang diberikan tidak valid', fieldDetails));
      }
      next(error);
    }
  };
}
