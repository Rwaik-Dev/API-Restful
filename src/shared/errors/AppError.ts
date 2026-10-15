export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: ErrorDetail[]): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details: ErrorDetail[]): AppError {
    return new AppError(400, 'VALIDATION_ERROR', 'Os dados enviados são inválidos.', details);
  }

  static unauthorized(message = 'Autenticação inválida ou ausente.'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Você não tem permissão para esta ação.'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Recurso não encontrado.'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }

  static unprocessable(message: string, details?: ErrorDetail[]): AppError {
    return new AppError(422, 'BUSINESS_RULE_VIOLATION', message, details);
  }
}
