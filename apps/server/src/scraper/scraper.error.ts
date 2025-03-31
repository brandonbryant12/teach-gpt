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
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'ScraperError';
    Object.setPrototypeOf(this, ScraperError.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScraperError);
    }
  }
}
