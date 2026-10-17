/** Error carrying an HTTP status; the API layer maps it to a response. */
export class HttpError extends Error {
  /**
   * @param status - HTTP status code sent to the client.
   * @param message - Human-readable error message.
   * @param details - Optional extra payload (e.g. validation issues) included in the response.
   */
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * 404 with message `<what> not found`.
 * @param what - Name of the missing resource, e.g. `Fact 123`.
 * @returns An `HttpError` with status 404.
 */
export const notFound = (what: string): HttpError => new HttpError(404, `${what} not found`);

/**
 * 400 Bad Request.
 * @param msg - Error message.
 * @param details - Optional extra payload.
 * @returns An `HttpError` with status 400.
 */
export const badRequest = (msg: string, details?: unknown): HttpError => new HttpError(400, msg, details);

/**
 * 422 Unprocessable Entity: well-formed input that fails validation or a state check.
 * @param msg - Error message.
 * @param details - Optional extra payload.
 * @returns An `HttpError` with status 422.
 */
export const unprocessable = (msg: string, details?: unknown): HttpError => new HttpError(422, msg, details);

/**
 * 403 Forbidden, e.g. when a required consent is missing.
 * @param msg - Error message.
 * @returns An `HttpError` with status 403.
 */
export const forbidden = (msg: string): HttpError => new HttpError(403, msg);
