// Custom Error for LLM interactions
export class LlmError extends Error {
  constructor(
    message: string,
    public readonly type:
      | 'API_ERROR'
      | 'TIMEOUT'
      | 'INVALID_CONFIG'
      | 'QUOTA_EXCEEDED'
      | 'RESPONSE_FORMAT'
      | 'PROVIDER_NOT_SUPPORTED'
      | 'OTHER',
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'LlmError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LlmError);
    }
  }
}
