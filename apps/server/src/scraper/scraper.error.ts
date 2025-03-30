export class ScraperError extends Error {
  constructor(
    message: string,
    public readonly type:
      | 'FETCH_FAILED'
      | 'PARSE_FAILED'
      | 'NO_CONTENT'
      | 'INVALID_URL'
      | 'TIMEOUT'
      | 'OTHER',
    public originalError?: Error,
    public statusCode?: number, // Optional HTTP status if relevant to FETCH_FAILED
  ) {
    super(message);
    this.name = 'ScraperError';
    // Ensure the prototype chain is correct for instanceof checks
    Object.setPrototypeOf(this, ScraperError.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScraperError);
    }
  }
}
