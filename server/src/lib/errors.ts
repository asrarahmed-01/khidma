/**
 * An error that maps directly to an HTTP response.
 * `code` is a stable, machine-readable string the mobile app uses to pick a
 * translated message (Arabic or English); `message` is for developers.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);

export const unauthorized = (message = "Authentication required") =>
  new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "You are not allowed to do this") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (what: string) => new AppError(404, "NOT_FOUND", `${what} not found`);

export const conflict = (code: string, message: string) => new AppError(409, code, message);

export const tooManyRequests = (code: string, message: string, details?: unknown) =>
  new AppError(429, code, message, details);
