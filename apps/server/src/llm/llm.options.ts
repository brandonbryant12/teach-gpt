export interface LlmGenerationOptions {
  systemPrompt?: string;
  modelOverride?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  /**
   * A description or schema (e.g., a stringified JSON schema or TypeScript interface)
   * guiding the LLM on the expected JSON output structure.
   */
  jsonSchemaDescription?: string;
}
