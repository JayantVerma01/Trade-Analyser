export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}
