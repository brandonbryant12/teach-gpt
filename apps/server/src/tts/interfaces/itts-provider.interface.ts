/**
 * Options passed FROM TtsService TO a specific ITtsProvider implementation.
 * Uses provider-specific voice identifiers.
 */
export interface ProviderTtsOptions {
  /** The voice ID specific to the TTS provider (e.g., "onyx", "en-US-Neural2-D"). */
  providerVoiceId: string;
  /** Optional language code (e.g., 'en-US'). */
  languageCode?: string;
  /** Optional speech speed adjustment. */
  speed?: number;
  /** The desired audio format. Must be 'mp3' for this application. */
  audioFormat?: 'mp3'; // Keep for potential future flexibility, but enforce MP3 buffer return
}

/**
 * Interface for Text-to-Speech provider implementations.
 * Each provider must be able to generate speech audio as an MP3 buffer.
 */
export interface ITtsProvider {
  /**
   * Generates speech audio from the provided text.
   * @param text - The text content to synthesize.
   * @param options - Provider-specific options for generation (voice ID, language, speed).
   * @returns A Promise resolving with a Node.js Buffer containing the MP3 audio data.
   * @throws {TtsError} if speech generation fails.
   */
  generateSpeech(text: string, options: ProviderTtsOptions): Promise<Buffer>;
}

/**
 * Injection token for the TTS provider service.
 * Allows swapping implementations via configuration.
 */
export const TTS_PROVIDER_SERVICE = 'TTS_PROVIDER_SERVICE';
