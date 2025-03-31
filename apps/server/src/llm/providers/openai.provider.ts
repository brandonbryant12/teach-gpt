/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai'; // Requires 'openai' package
import { ILlmProvider } from '../llm.interface';
import { LlmGenerationOptions } from '../llm.options';
import { LlmError } from '../llm.error';

@Injectable()
export class OpenAiProvider implements ILlmProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private client: OpenAI;
  private defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.defaultModel = this.configService.get<string>(
      'OPENAI_DEFAULT_MODEL',
      'gpt-4o', // Default if not set in env
    );

    if (!apiKey) {
      this.logger.error(
        'OpenAI API key is missing. Set OPENAI_API_KEY environment variable.',
      );
      // We don't throw here immediately, as the app might run with a different provider.
      // Errors will occur if attempts are made to use this provider.
      // Consider throwing new LlmError(..., 'INVALID_CONFIG') if OpenAI is explicitly selected
      // but the key is missing during module initialization (in the factory perhaps).
    } else {
      this.client = new OpenAI({ apiKey });
      this.logger.log(
        `Initialized OpenAiProvider with model: ${this.defaultModel}`,
      );
    }
  }

  private ensureClientInitialized(): void {
    if (!this.client) {
      throw new LlmError(
        'OpenAI client was not initialized. Missing API key?',
        'INVALID_CONFIG',
      );
    }
  }

  async generateTextResponse(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<string> {
    this.ensureClientInitialized();
    this.logger.debug('Generating text response via OpenAI');

    const model = options?.modelOverride || this.defaultModel;
    console.log({ model });
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const completion = await this.client.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        // Add other supported OpenAI parameters from options if needed
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new LlmError(
          'OpenAI returned an empty response content.',
          'RESPONSE_FORMAT',
        );
      }

      this.logger.debug('Successfully received text response from OpenAI');
      return content;
    } catch (error: any) {
      this.handleOpenAiError(error, 'generateTextResponse');
    }
  }

  async generateJsonResponse<T = any>(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<T> {
    this.ensureClientInitialized();
    this.logger.debug('Generating JSON response via OpenAI');

    const model = options?.modelOverride || this.defaultModel;
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    let systemContent =
      'You are a helpful assistant designed to output JSON. Ensure your response is valid JSON formatted according to the user instructions.';

    if (options?.systemPrompt) {
      systemContent = options.systemPrompt;
    }

    if (options?.jsonSchemaDescription) {
      systemContent += `\n\nThe required JSON output structure is described as follows:\n${options.jsonSchemaDescription}`;
    }

    messages.push({ role: 'system', content: systemContent });
    messages.push({ role: 'user', content: prompt });

    try {
      const completion = await this.client.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new LlmError(
          'OpenAI returned an empty response content for JSON request.',
          'RESPONSE_FORMAT',
        );
      }

      try {
        const parsedJson = JSON.parse(content);
        this.logger.debug(
          'Successfully received and parsed JSON response from OpenAI',
        );
        return parsedJson as T;
      } catch (parseError: any) {
        this.logger.error(
          `Failed to parse JSON response from OpenAI: ${parseError.message}`,
          content,
        );
        throw new LlmError(
          `OpenAI returned invalid JSON: ${parseError.message}`,
          'RESPONSE_FORMAT',
          parseError,
        );
      }
    } catch (error: any) {
      this.handleOpenAiError(error, 'generateJsonResponse');
    }
  }

  private handleOpenAiError(error: any, context: string): never {
    this.logger.error(
      `OpenAI API Error during ${context}: ${error.message}`,
      error,
    );

    let errorType: LlmError['type'] = 'API_ERROR';
    let message = `OpenAI API Error: ${error.message}`;

    if (error instanceof OpenAI.APIError) {
      // Handle specific OpenAI error types if needed
      if (error.status === 401) {
        errorType = 'INVALID_CONFIG';
        message = 'OpenAI API Error: Authentication failed. Check API key.';
      } else if (error.status === 429) {
        errorType = 'QUOTA_EXCEEDED';
        message = 'OpenAI API Error: Rate limit or quota exceeded.';
      } else if (error.status >= 500) {
        message = 'OpenAI API Error: Server error.';
      }
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorType = 'TIMEOUT';
      message = 'OpenAI API Error: Request timed out.';
    }

    throw new LlmError(message, errorType, error);
  }
}
