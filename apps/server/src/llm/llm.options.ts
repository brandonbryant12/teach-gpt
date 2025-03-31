export interface LlmGenerationOptions {
  systemPrompt?: string;
  modelOverride?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}
