export class TtsError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'TtsError';
    // Ensure the prototype chain is set correctly
    Object.setPrototypeOf(this, TtsError.prototype);
  }
}
