/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerateContentRequest,
  Part,
} from '@google/generative-ai'; // Requires '@google/generative-ai' package
import { ILlmProvider } from '../llm.interface';
import { LlmGenerationOptions } from '../llm.options';
import { LlmError } from '../llm.error';

@Injectable()
export class GoogleAiProvider implements ILlmProvider {
  private readonly logger = new Logger(GoogleAiProvider.name);
  private genAI: GoogleGenerativeAI;
  private defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
    this.defaultModel = this.configService.get<string>(
      'GOOGLE_DEFAULT_MODEL',
      'gemini-1.5-flash', // Default model if not set
    );

    if (!apiKey) {
      this.logger.error(
        'Google AI API key is missing. Set GOOGLE_API_KEY environment variable.',
      );
      // Similar to OpenAI, don't throw immediately unless configured
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log(
        `Initialized GoogleAiProvider with model: ${this.defaultModel}`,
      );
    }
  }

  private ensureClientInitialized(): void {
    if (!this.genAI) {
      throw new LlmError(
        'Google AI client was not initialized. Missing API key?',
        'INVALID_CONFIG',
      );
    }
  }

  async generateTextResponse(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<string> {
    this.ensureClientInitialized();
    this.logger.debug('Generating text response via Google AI');

    const modelName = options?.modelOverride || this.defaultModel;
    const model = this.genAI.getGenerativeModel({ model: modelName });

    const generationConfig = {
      // Only include parameters if they are defined in options
      ...(options?.maxTokens && { maxOutputTokens: options.maxTokens }),
      ...(options?.temperature && { temperature: options.temperature }),
      // Add other Google-specific parameters from options if needed (e.g., topP, topK)
    };

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];

    // Construct the request parts
    const parts: Part[] = [];
    if (options?.systemPrompt) {
      // Google AI uses a different structure for system prompts
      // It needs to be part of the initial message history or specific model params
      // For basic text generation, we prepend it to the main prompt for simplicity here.
      // More complex chat scenarios might need proper history management.
      this.logger.warn(
        'Google AI provider currently prepends systemPrompt to the user prompt for text generation.',
      );
      parts.push({ text: options.systemPrompt });
    }
    parts.push({ text: prompt });

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig,
        safetySettings,
      });

      const response = result.response;
      const text = response.text(); // Use the text() helper method

      if (!text) {
        // Check for blocked content
        const promptFeedback = response.promptFeedback;
        if (promptFeedback?.blockReason) {
          this.logger.error(
            `Google AI request blocked due to: ${promptFeedback.blockReason}`,
            promptFeedback,
          );
          throw new LlmError(
            `Google AI request blocked due to safety settings: ${promptFeedback.blockReason}`,
            'API_ERROR', // Or a more specific error type if desired
          );
        }
        throw new LlmError(
          'Google AI returned an empty response content.',
          'RESPONSE_FORMAT',
        );
      }

      this.logger.debug('Successfully received text response from Google AI');
      return text;
    } catch (error: any) {
      this.handleGoogleAiError(error, 'generateTextResponse');
    }
  }

  async generateJsonResponse<T = any>(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<T> {
    this.ensureClientInitialized();
    this.logger.debug('Generating JSON response via Google AI');

    const modelName = options?.modelOverride || this.defaultModel;
    // Ensure the model supports JSON output - check Gemini documentation
    // Models like gemini-1.5-pro often support JSON mode better
    // if (modelName !== 'gemini-1.5-pro-latest') {
    //   this.logger.warn(`Model ${modelName} might not fully support JSON mode.`);
    // }
    const model = this.genAI.getGenerativeModel({ model: modelName });

    const generationConfig = {
      responseMimeType: 'application/json', // Explicitly request JSON
      ...(options?.maxTokens && { maxOutputTokens: options.maxTokens }),
      ...(options?.temperature && { temperature: options.temperature }),
    };

    const safetySettings = [
      // Same safety settings as text generation
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];

    // Construct the request parts, including system prompt if provided
    const parts: Part[] = [];
    // System prompt handling (similar to text, prepending for simplicity)
    if (options?.systemPrompt) {
      this.logger.warn(
        'Google AI provider currently prepends systemPrompt to the user prompt for JSON generation.',
      );
      parts.push({ text: options.systemPrompt });
    } else {
      // Add a default instruction for JSON if no system prompt
      parts.push({
        text: 'You are a helpful assistant designed to output JSON. Ensure your response is valid JSON formatted according to the user instructions.',
      });
    }
    parts.push({ text: prompt }); // The main prompt instructing the desired JSON structure

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig,
        safetySettings,
      });

      const response = result.response;
      const text = response.text();

      if (!text) {
        const promptFeedback = response.promptFeedback;
        if (promptFeedback?.blockReason) {
          this.logger.error(
            `Google AI JSON request blocked due to: ${promptFeedback.blockReason}`,
            promptFeedback,
          );
          throw new LlmError(
            `Google AI JSON request blocked due to safety settings: ${promptFeedback.blockReason}`,
            'API_ERROR',
          );
        }
        throw new LlmError(
          'Google AI returned empty content for JSON request.',
          'RESPONSE_FORMAT',
        );
      }

      try {
        const parsedJson = JSON.parse(text);
        this.logger.debug(
          'Successfully received and parsed JSON response from Google AI',
        );
        return parsedJson as T;
      } catch (parseError: any) {
        this.logger.error(
          `Failed to parse JSON response from Google AI: ${parseError.message}`,
          text, // Log the raw content
        );
        throw new LlmError(
          `Google AI returned invalid JSON: ${parseError.message}`,
          'RESPONSE_FORMAT',
          parseError,
        );
      }
    } catch (error: any) {
      this.handleGoogleAiError(error, 'generateJsonResponse');
    }
  }

  private handleGoogleAiError(error: any, context: string): never {
    this.logger.error(
      `Google AI API Error during ${context}: ${error.message || error}`,
      error,
    );

    // Attempt to classify the error - Google AI SDK might have specific error types/codes
    // For now, using generic types
    let errorType: LlmError['type'] = 'API_ERROR';
    let message = `Google AI API Error: ${error.message || 'Unknown error'}`;

    // TODO: Add more specific error handling based on Google AI SDK error details if available
    // e.g., check error codes for quota, authentication, timeouts etc.
    if (error.message?.includes('API key not valid')) {
      errorType = 'INVALID_CONFIG';
      message = 'Google AI API Error: Authentication failed. Check API key.';
    } else if (error.message?.includes('quota')) {
      errorType = 'QUOTA_EXCEEDED';
      message = 'Google AI API Error: Quota exceeded.';
    }

    throw new LlmError(
      message,
      errorType,
      error instanceof Error ? error : undefined,
    );
  }
}
