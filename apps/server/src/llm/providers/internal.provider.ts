import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { ILlmProvider } from '../llm.interface';
import { LlmGenerationOptions } from '../llm.options';
import { LlmError } from '../llm.error';

const CACHE_KEY_TOKEN = 'internal_llm_token';
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutes in milliseconds

interface InternalTokenResponse {
  access_token: string;
  // Add other potential fields if needed, e.g., expires_in
}

interface InternalLlmTextRequest {
  prompt: string;
  // Add other parameters your internal LLM might need
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
}

interface InternalLlmTextResponse {
  response: string;
  // Add other fields if your internal LLM returns more data
}

// Assume JSON request is similar, but maybe has a 'json_mode: true' flag
interface InternalLlmJsonRequest extends InternalLlmTextRequest {
  json_mode?: boolean; // Example flag
  schema_description?: string; // New field for schema description
}

@Injectable()
export class InternalProvider implements ILlmProvider {
  private readonly logger = new Logger(InternalProvider.name);
  private readonly tokenUrl: string;
  private readonly llmUrl: string;
  private readonly tokenAuthHeader: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.tokenUrl = this.configService.getOrThrow<string>('INTERNAL_TOKEN_URL');
    this.llmUrl = this.configService.getOrThrow<string>('INTERNAL_LLM_URL');
    this.tokenAuthHeader = this.configService.get<string>(
      'INTERNAL_PROVIDER_AUTH_HEADER',
    );

    this.logger.log(
      `Initialized InternalProvider. Token URL: ${this.tokenUrl}, LLM URL: ${this.llmUrl}`,
    );
  }

  private async getToken(): Promise<string> {
    const cachedToken = await this.cacheManager.get<string>(CACHE_KEY_TOKEN);
    if (cachedToken) {
      this.logger.debug('Using cached internal token.');
      return cachedToken;
    }

    this.logger.log('Fetching new internal token...');
    try {
      const headers: Record<string, string> = {};
      if (this.tokenAuthHeader) {
        // Assuming the header value includes the type, e.g., "Basic dXNlcjpwYXNz"
        const [type, value] = this.tokenAuthHeader.split(' ', 2);
        if (type && value) {
          // Correctly split based on the first space
          headers['Authorization'] = `${type} ${value}`;
        } else {
          // Handle cases where the header might not be formatted as expected
          // Maybe log a warning or use it as is if it's just a token value
          this.logger.warn(
            `INTERNAL_PROVIDER_AUTH_HEADER format might be unexpected: ${this.tokenAuthHeader}. Using it directly in Authorization header.`,
          );
          headers['Authorization'] = this.tokenAuthHeader;
        }
      }

      // Assuming a GET request for the token, adjust method if needed (e.g., POST)
      const response = await firstValueFrom(
        this.httpService.get<InternalTokenResponse>(this.tokenUrl, {
          headers,
        }),
      );

      const token = response.data?.access_token;
      if (!token) {
        throw new Error('Access token not found in token endpoint response');
      }

      await this.cacheManager.set(CACHE_KEY_TOKEN, token, TOKEN_TTL_MS);
      this.logger.log('Successfully fetched and cached new internal token.');
      return token;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch internal token: ${error.message}`,
        error.stack,
        error.response?.data, // Log response data if available
      );
      const message =
        error instanceof AxiosError
          ? `Failed to fetch internal token: ${error.response?.status} ${error.code}`
          : `Failed to fetch internal token: ${error.message}`;

      throw new LlmError(message, 'INVALID_CONFIG', error); // Or 'API_ERROR'
    }
  }

  async generateTextResponse(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<string> {
    this.logger.debug('Generating text response via Internal LLM');
    const token = await this.getToken();

    const requestBody: InternalLlmTextRequest = {
      prompt: prompt,
      ...(options?.systemPrompt && { system_prompt: options.systemPrompt }),
      ...(options?.maxTokens && { max_tokens: options.maxTokens }),
      ...(options?.temperature && { temperature: options.temperature }),
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<InternalLlmTextResponse>(
          this.llmUrl,
          requestBody,
          {
            headers: { Authorization: `Bearer ${token}` },
            // Consider adding a timeout
            // timeout: this.configService.get<number>('INTERNAL_LLM_TIMEOUT', 30000),
          },
        ),
      );

      const content = response.data?.response;
      if (typeof content !== 'string' || content.length === 0) {
        this.logger.error(
          'Internal LLM returned invalid or empty text response',
          response.data,
        );
        throw new LlmError(
          'Internal LLM returned invalid or empty response.',
          'RESPONSE_FORMAT',
        );
      }

      this.logger.debug(
        'Successfully received text response from Internal LLM',
      );
      return content;
    } catch (error: any) {
      this.handleInternalLlmError(error, 'generateTextResponse');
    }
  }

  async generateJsonResponse<T = any>(
    prompt: string,
    options?: LlmGenerationOptions,
  ): Promise<T> {
    this.logger.debug('Generating JSON response via Internal LLM');
    const token = await this.getToken();

    const requestBody: InternalLlmJsonRequest = {
      prompt: prompt, // Your prompt should instruct the LLM to return JSON
      json_mode: true, // Assuming the internal API uses a flag like this
      ...(options?.systemPrompt && { system_prompt: options.systemPrompt }),
      ...(options?.maxTokens && { max_tokens: options.maxTokens }),
      ...(options?.temperature && { temperature: options.temperature }),
      ...(options?.jsonSchemaDescription && {
        // Add schema if provided
        schema_description: options.jsonSchemaDescription,
      }),
    };

    try {
      const response = await firstValueFrom(
        // Assuming the response body *is* the JSON object directly
        this.httpService.post<T>(this.llmUrl, requestBody, {
          // Send updated requestBody
          headers: { Authorization: `Bearer ${token}` },
          // Consider adding a timeout
          // timeout: this.configService.get<number>('INTERNAL_LLM_TIMEOUT', 60000),
        }),
      );

      const jsonData = response.data;
      if (typeof jsonData !== 'object' || jsonData === null) {
        this.logger.error(
          'Internal LLM returned non-object response for JSON request',
          jsonData,
        );
        throw new LlmError(
          'Internal LLM returned non-object response for JSON request.',
          'RESPONSE_FORMAT',
        );
      }

      this.logger.debug(
        'Successfully received JSON response from Internal LLM',
      );
      return jsonData;
    } catch (error: any) {
      this.handleInternalLlmError(error, 'generateJsonResponse');
    }
  }

  private handleInternalLlmError(error: any, context: string): never {
    this.logger.error(
      `Internal LLM API Error during ${context}: ${error.message}`,
      error.stack,
      error.response?.data, // Log response data if available
    );

    let errorType: LlmError['type'] = 'API_ERROR';
    let message = `Internal LLM API Error: ${error.message}`;

    if (error instanceof AxiosError) {
      message = `Internal LLM API Error (${context}): ${error.response?.status} ${error.code ?? error.message}`;
      if (error.response?.status === 401 || error.response?.status === 403) {
        errorType = 'INVALID_CONFIG'; // Or API_ERROR, depending on if token expiry is the cause
        message = `Internal LLM API Error: Authentication failed (${error.response.status}). Check token or permissions.`;
        // Potential improvement: Clear cached token if 401/403?
        // this.cacheManager.del(CACHE_KEY_TOKEN);
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorType = 'TIMEOUT';
        message = 'Internal LLM API Error: Request timed out.';
      } else if (error.response?.status && error.response.status >= 500) {
        message = `Internal LLM API Error: Server error (${error.response.status}).`;
      }
      // Include response body in error message if useful and available
      if (error.response?.data) {
        const responseBody =
          typeof error.response.data === 'object'
            ? JSON.stringify(error.response.data)
            : String(error.response.data);
        message += ` - Response: ${responseBody.substring(0, 200)}${responseBody.length > 200 ? '...' : ''}`;
      }
    }

    throw new LlmError(message, errorType, error);
  }
}
