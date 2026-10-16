export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unprocessable = (msg: string, details?: unknown) => new HttpError(422, msg, details);
export const forbidden = (msg: string) => new HttpError(403, msg);
