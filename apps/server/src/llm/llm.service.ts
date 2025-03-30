import { Inject, Injectable, Logger } from '@nestjs/common';
import { ILlmProvider, LLM_PROVIDER } from './llm.interface';
import { LlmGenerationOptions } from './llm.options';
import { LlmError } from './llm.error';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: ILlmProvider,
  ) {
    this.logger.log(
      `LlmService initialized with provider: ${llmProvider.constructor.name}`,
    );
  }

  /**
   * Generates a plain text response from the configured LLM.
   *
   * @param prompt The main instruction or question for the LLM.
   * @param options Optional parameters to control the generation process.
   * @returns A promise resolving to the generated text string.
   * @throws {LlmError} If the generation fails due to API issues, configuration problems, etc.
   */
  async generateTextResponse(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<string> {
    this.logger.debug(
      `Generating text response for prompt: "${prompt.substring(0, 100)}..."`,
    );
    try {
      const response = await this.llmProvider.generateTextResponse(
        prompt,
        options,
      );
      this.logger.debug(`Received text response (length: ${response.length})`);
      return response;
    } catch (error) {
      this.handleProviderError(error, 'generateTextResponse');
    }
  }

  /**
   * Generates a response formatted as JSON from the configured LLM.
   *
   * @param prompt The main instruction, specifying the desired JSON structure.
   * @param options Optional parameters, including `jsonMode: true` if required by the provider.
   * @returns A promise resolving to the parsed JSON object of type T.
   * @throws {LlmError} If generation fails or the response is not valid JSON.
   */
  async generateJsonResponse<T = any>(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<T> {
    this.logger.debug(
      `Generating JSON response for prompt: "${prompt.substring(0, 100)}..."`,
    );
    const effectiveOptions = { ...options, jsonMode: true }; // Ensure jsonMode is requested
    try {
      const response = await this.llmProvider.generateJsonResponse<T>(
        prompt,
        effectiveOptions,
      );
      this.logger.debug(`Received JSON response`);
      // Basic validation - provider should ideally handle parsing
      if (typeof response !== 'object' || response === null) {
        throw new LlmError(
          'LLM provider returned non-object response for JSON request.',
          'RESPONSE_FORMAT',
        );
      }
      return response;
    } catch (error) {
      this.handleProviderError(error, 'generateJsonResponse');
    }
  }

  /**
   * Centralized error handling for provider calls.
   * Re-throws errors as LlmError.
   */
  private handleProviderError(error: any, methodName: string): never {
    if (error instanceof LlmError) {
      this.logger.error(
        `LLM provider error in ${methodName} (${error.type}): ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw known LlmError
    } else {
      this.logger.error(
        `Unexpected error during LLM provider call in ${methodName}: ${error.message}`,
        error.stack,
      );
      // Wrap unexpected errors
      throw new LlmError(
        `An unexpected error occurred in the LLM provider: ${error.message}`,
        'OTHER',
        error instanceof Error ? error : undefined,
      );
    }
  }
}
