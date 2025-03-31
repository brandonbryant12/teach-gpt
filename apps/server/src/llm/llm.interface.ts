import { LlmGenerationOptions } from './llm.options';

export interface ILlmProvider {
  generateTextResponse(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<string>;
  generateJsonResponse<T = any>(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<T>;
}

export const LLM_PROVIDER = 'LLM_PROVIDER';
