/**
 * Options passed TO the main TtsService.
 * Uses application-defined voice names.
 */
export interface TtsGenerationOptions {
  /** The desired voice for the speech generation. */
  voice: 'Ash' | 'Jenny';
  /** Optional language code (e.g., 'en-US'). Provider might have defaults. */
  languageCode?: string;
  /** Optional speech speed adjustment. Provider-specific interpretation. */
  speed?: number; // Consider defining a range or enum later if needed
}
