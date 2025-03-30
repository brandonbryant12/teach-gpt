// Options for LLM generation calls
export interface LlmGenerationOptions {
  systemPrompt?: string; // Optional system message/context
  modelOverride?: string; // Optionally specify a different model than the default for this provider
  maxTokens?: number; // Max tokens for the response
  temperature?: number; // Creativity/randomness (e.g., 0.0 to 1.0)
  jsonMode?: boolean; // Instructs the provider to return valid JSON (if supported)
  // Add other common parameters as needed (e.g., topP, stopSequences)
}
