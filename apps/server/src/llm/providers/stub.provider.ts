import { Injectable, Logger } from '@nestjs/common';
import { ILlmProvider } from '../llm.interface';
import { LlmGenerationOptions } from '../llm.options';
import { LlmError } from '../llm.error';

/**
 * A stub implementation of ILlmProvider for testing or development.
 * Returns predictable dummy responses without making real API calls.
 */
@Injectable()
export class StubLlmProvider implements ILlmProvider {
  private readonly logger = new Logger(StubLlmProvider.name);

  constructor() {
    this.logger.log('Initialized StubLlmProvider');
  }

  async generateTextResponse(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<string> {
    this.logger.debug(
      `[STUB] Generating text response for prompt: "${prompt.substring(0, 50)}..."`,
      options,
    );
    await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate delay
    return `[STUB] Text response for prompt about "${prompt.substring(0, 30)}..."`;
  }

  async generateJsonResponse<T = any>(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<T> {
    this.logger.debug(
      `[STUB] Generating JSON response for prompt: "${prompt.substring(0, 50)}..."`,
      options,
    );

    if (!options?.jsonMode) {
      this.logger.warn(
        '[STUB] jsonMode was not explicitly requested in options, but generateJsonResponse was called.',
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate delay

    // Attempt to create a plausible JSON structure based on a typical request
    let response: any;
    if (prompt.toLowerCase().includes('summary')) {
      response = {
        stubTitle: 'Stubbed Summary Title',
        stubSummary: `Stubbed summary for prompt: ${prompt.substring(0, 30)}...`,
        stubTopics: ['stub', 'testing', 'development'],
      };
    } else if (prompt.toLowerCase().includes('quiz')) {
      response = {
        stubQuizTitle: 'Stubbed Quiz',
        stubQuestions: [
          { q: 'Stub question 1?', a: 'Stub answer 1' },
          { q: 'Stub question 2?', a: 'Stub answer 2' },
        ],
      };
    } else {
      // Default stub JSON
      response = {
        stubMessage: 'This is a stubbed JSON response.',
        promptReceived: prompt.substring(0, 100) + '...',
        optionsReceived: options,
      };
    }

    try {
      // Simulate potential JSON stringify/parse issues (though unlikely here)
      const jsonString = JSON.stringify(response);
      return JSON.parse(jsonString) as T;
    } catch (error) {
      throw new LlmError(
        '[STUB] Failed to generate or parse stubbed JSON response.',
        'RESPONSE_FORMAT',
        error instanceof Error ? error : undefined,
      );
    }
  }
}
