import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { logger } from '../../config/logger.js';
import { AppError } from './AppError.js';

interface BodyParserError {
  type: string;
  status: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return typeof error === 'object' && error !== null && 'type' in error && 'status' in error;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function toAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;

  if (isBodyParserError(error)) {
    if (error.type === 'entity.parse.failed') {
      return new AppError(400, 'INVALID_JSON', 'O corpo da requisição não é um JSON válido.');
    }
    if (error.type === 'entity.too.large') {
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'O corpo da requisição excede o limite.');
    }
    if (error.status >= 400 && error.status < 500) {
      return AppError.badRequest('Requisição malformada.');
    }
  }

  if (error instanceof mongoose.Error.CastError) {
    return AppError.badRequest('Identificador ou valor inválido.', [
      { field: error.path, message: 'Valor inválido.' },
    ]);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return AppError.validation(
      Object.values(error.errors).map((issue) => ({ field: issue.path, message: issue.message })),
    );
  }

  if (isDuplicateKeyError(error)) {
    return AppError.conflict('O recurso já existe.');
  }

  return null;
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound('Rota não encontrada.'));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const appError = toAppError(error);

  if (!appError) {
    logger.error({ err: error, requestId: req.id }, 'Unhandled error');
  }

  const status = appError?.statusCode ?? 500;
  res.status(status).json({
    success: false,
    error: {
      code: appError?.code ?? 'INTERNAL_ERROR',
      message: appError?.message ?? 'Erro interno inesperado.',
      ...(appError?.details ? { details: appError.details } : {}),
      requestId: req.id,
    },
  });
};
