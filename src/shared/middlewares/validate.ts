import type { RequestHandler } from 'express';
import { z } from 'zod';
import { pt } from 'zod/locales';
import { AppError, type ErrorDetail } from '../errors/AppError.js';

z.config(pt());

type Location = 'body' | 'params' | 'query';
type Schemas = Partial<Record<Location, z.ZodType>>;

function toDetails(error: z.ZodError, location: Location): ErrorDetail[] {
  return error.issues.flatMap((issue) => {
    const base = issue.path.map(String).join('.');
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        field: base ? `${base}.${key}` : key,
        message: 'Campo não permitido.',
      }));
    }
    return [{ field: base || location, message: issue.message }];
  });
}

/**
 * Valida body, params e query com Zod e substitui os valores pelos dados já
 * convertidos. Controllers podem confiar nos tipos inferidos dos schemas.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const details: ErrorDetail[] = [];
    const parsed: Partial<Record<Location, unknown>> = {};

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = schemas[location];
      if (!schema) continue;
      const result = schema.safeParse(req[location] ?? {});
      if (result.success) parsed[location] = result.data;
      else details.push(...toDetails(result.error, location));
    }

    if (details.length > 0) {
      next(AppError.validation(details));
      return;
    }

    if ('body' in parsed) req.body = parsed.body;
    if ('params' in parsed) req.params = parsed.params as typeof req.params;
    if ('query' in parsed) {
      Object.defineProperty(req, 'query', {
        value: parsed.query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
}

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido.');
