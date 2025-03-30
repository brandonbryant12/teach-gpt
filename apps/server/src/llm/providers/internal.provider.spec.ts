import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';

import { InternalProvider } from './internal.provider';
import { LlmError } from '../llm.error';

// Mock dependencies
const mockConfigService = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
};

const mockHttpService = {
  get: jest.fn(),
  post: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(), // Added for potential future use (e.g., clearing token on 401)
};

// Helper to create AxiosResponses
function createAxiosResponse<T>(data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

// Helper to create AxiosErrors
function createAxiosError(
  status: number,
  code?: string,
  response?: AxiosResponse,
): AxiosError {
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    code,
    response?.config,
    {}, // request
    response, // response
  );
  // Manually set status if response is undefined, common for network errors
  if (!error.response) {
    error.response = { status } as AxiosResponse;
  }
  return error;
}

describe('InternalProvider', () => {
  let provider: InternalProvider;
  let httpService: HttpService;
  let cacheManager: Cache;
  let configService: ConfigService;

  const FAKE_TOKEN_URL = 'http://token.test';
  const FAKE_LLM_URL = 'http://llm.test';
  const FAKE_TOKEN = 'fake-access-token-123';
  const FAKE_AUTH_HEADER = 'Basic dXNlcjpwYXNz';

  beforeEach(async () => {
    // Reset mocks for each test
    jest.clearAllMocks();

    // Setup default mock implementations
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'INTERNAL_TOKEN_URL') return FAKE_TOKEN_URL;
      if (key === 'INTERNAL_LLM_URL') return FAKE_LLM_URL;
      throw new Error(`Missing config key: ${key}`);
    });
    mockConfigService.get.mockReturnValue(undefined); // Default no auth header

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalProvider,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    provider = module.get<InternalProvider>(InternalProvider);
    httpService = module.get<HttpService>(HttpService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('Initialization', () => {
    it('should read URLs from ConfigService', () => {
      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'INTERNAL_TOKEN_URL',
      );
      expect(configService.getOrThrow).toHaveBeenCalledWith('INTERNAL_LLM_URL');
      // Access private members for testing initialization is generally discouraged,
      // but sometimes necessary. Alternatively, test behavior that relies on these.
      expect((provider as any).tokenUrl).toBe(FAKE_TOKEN_URL);
      expect((provider as any).llmUrl).toBe(FAKE_LLM_URL);
    });

    it('should read optional auth header from ConfigService', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_PROVIDER_AUTH_HEADER') return FAKE_AUTH_HEADER;
        return undefined;
      });

      // Re-create provider with the new mock setup for this specific test
      const module = await Test.createTestingModule({
        providers: [
          InternalProvider,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: HttpService, useValue: mockHttpService },
          { provide: CACHE_MANAGER, useValue: mockCacheManager },
        ],
      }).compile();
      const providerWithAuth = module.get<InternalProvider>(InternalProvider);

      expect(configService.get).toHaveBeenCalledWith(
        'INTERNAL_PROVIDER_AUTH_HEADER',
      );
      expect((providerWithAuth as any).tokenAuthHeader).toBe(FAKE_AUTH_HEADER);
    });
  });

  describe('getToken', () => {
    it('should return cached token if available', async () => {
      mockCacheManager.get.mockResolvedValue(FAKE_TOKEN);
      const token = await (provider as any).getToken();
      expect(token).toBe(FAKE_TOKEN);
      expect(cacheManager.get).toHaveBeenCalledWith('internal_llm_token');
      expect(httpService.get).not.toHaveBeenCalled();
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should fetch token if not cached', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockHttpService.get.mockReturnValue(
        of(createAxiosResponse({ access_token: FAKE_TOKEN })),
      );
      const token = await (provider as any).getToken();
      expect(token).toBe(FAKE_TOKEN);
      expect(cacheManager.get).toHaveBeenCalledWith('internal_llm_token');
      expect(httpService.get).toHaveBeenCalledWith(FAKE_TOKEN_URL, {
        headers: {},
      });
      expect(cacheManager.set).toHaveBeenCalledWith(
        'internal_llm_token',
        FAKE_TOKEN,
        55 * 60 * 1000,
      );
    });

    it('should include auth header if configured when fetching token', async () => {
      // Setup config mock to return the auth header
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_PROVIDER_AUTH_HEADER') return FAKE_AUTH_HEADER;
        return undefined;
      });

      // Re-create provider instance with this config setup
      const module = await Test.createTestingModule({
        providers: [
          InternalProvider,
          { provide: ConfigService, useValue: mockConfigService }, // Uses the mock that now returns the header
          { provide: HttpService, useValue: mockHttpService },
          { provide: CACHE_MANAGER, useValue: mockCacheManager },
        ],
      }).compile();
      const providerWithAuth = module.get<InternalProvider>(InternalProvider);

      mockCacheManager.get.mockResolvedValue(undefined);
      mockHttpService.get.mockReturnValue(
        of(createAxiosResponse({ access_token: FAKE_TOKEN })),
      );

      await (providerWithAuth as any).getToken();

      expect(httpService.get).toHaveBeenCalledWith(FAKE_TOKEN_URL, {
        headers: { Authorization: FAKE_AUTH_HEADER }, // Expect the parsed header
      });
    });

    it('should throw LlmError if token fetching fails (AxiosError)', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      const error = createAxiosError(401);
      mockHttpService.get.mockReturnValue(throwError(() => error));

      await expect((provider as any).getToken()).rejects.toThrow(
        new LlmError(
          'Failed to fetch internal token: 401 undefined', // Status code is included
          'INVALID_CONFIG',
          error,
        ),
      );
    });

    it('should throw LlmError if token fetching fails (non-AxiosError)', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      const error = new Error('Network Issue');
      mockHttpService.get.mockReturnValue(throwError(() => error));

      await expect((provider as any).getToken()).rejects.toThrow(
        new LlmError(
          `Failed to fetch internal token: ${error.message}`,
          'INVALID_CONFIG',
          error,
        ),
      );
    });

    it('should throw Error if access_token is missing in response', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockHttpService.get.mockReturnValue(of(createAxiosResponse({}))); // No access_token

      await expect((provider as any).getToken()).rejects.toThrow(
        new LlmError(
          'Failed to fetch internal token: Access token not found in token endpoint response',
          'INVALID_CONFIG',
          new Error('Access token not found in token endpoint response'),
        ),
      );
    });
  });

  describe('generateTextResponse', () => {
    beforeEach(() => {
      // Mock successful token retrieval by default for these tests
      mockCacheManager.get.mockResolvedValue(FAKE_TOKEN);
    });

    it('should call LLM API with correct parameters and return text response', async () => {
      const prompt = 'Test prompt';
      const expectedResponse = 'Test response';
      mockHttpService.post.mockReturnValue(
        of(createAxiosResponse({ response: expectedResponse })),
      );

      const result = await provider.generateTextResponse(prompt, {
        maxTokens: 10,
      });

      expect(result).toBe(expectedResponse);
      expect(httpService.post).toHaveBeenCalledWith(
        FAKE_LLM_URL,
        {
          prompt: prompt,
          max_tokens: 10,
          // temperature and system_prompt are not included if not provided
        },
        {
          headers: { Authorization: `Bearer ${FAKE_TOKEN}` },
        },
      );
      expect(cacheManager.get).toHaveBeenCalledTimes(1); // getToken called
    });

    it('should include options like temperature and system_prompt', async () => {
      const prompt = 'Test prompt';
      const options = {
        temperature: 0.5,
        systemPrompt: 'System Info',
        maxTokens: 50,
      };
      const expectedResponse = 'Test response';
      mockHttpService.post.mockReturnValue(
        of(createAxiosResponse({ response: expectedResponse })),
      );

      await provider.generateTextResponse(prompt, options);

      expect(httpService.post).toHaveBeenCalledWith(
        FAKE_LLM_URL,
        {
          prompt: prompt,
          temperature: options.temperature,
          system_prompt: options.systemPrompt,
          max_tokens: options.maxTokens,
        },
        { headers: { Authorization: `Bearer ${FAKE_TOKEN}` } },
      );
    });

    it('should throw LlmError if LLM API returns invalid response', async () => {
      const prompt = 'Test prompt';
      mockHttpService.post.mockReturnValue(of(createAxiosResponse({}))); // Missing 'response' field

      await expect(provider.generateTextResponse(prompt)).rejects.toThrow(
        new LlmError(
          'Internal LLM returned invalid or empty response.',
          'RESPONSE_FORMAT',
        ),
      );
    });

    it('should throw LlmError if LLM API call fails (e.g., 500)', async () => {
      const prompt = 'Test prompt';
      const apiErrorResponse = createAxiosResponse(
        { error: 'Server Issue' },
        500,
      );
      const error = createAxiosError(
        500,
        'INTERNAL_SERVER_ERROR',
        apiErrorResponse,
      );
      mockHttpService.post.mockReturnValue(throwError(() => error));

      await expect(provider.generateTextResponse(prompt)).rejects.toThrow(
        expect.objectContaining({
          type: 'API_ERROR',
          message: expect.stringContaining(
            'Internal LLM API Error: Server error (500)',
          ),
        }),
      );
    });

    it('should throw LlmError if LLM API call fails (401 Auth)', async () => {
      const prompt = 'Test prompt';
      const apiErrorResponse = createAxiosResponse(
        { error: 'Unauthorized' },
        401,
      );
      const error = createAxiosError(401, 'UNAUTHORIZED', apiErrorResponse);
      mockHttpService.post.mockReturnValue(throwError(() => error));

      await expect(provider.generateTextResponse(prompt)).rejects.toThrow(
        expect.objectContaining({
          type: 'INVALID_CONFIG', // Correctly classified
          message: expect.stringContaining(
            'Internal LLM API Error: Authentication failed (401)',
          ),
        }),
      );
      // Potential improvement check: expect(cacheManager.del).toHaveBeenCalledWith(CACHE_KEY_TOKEN);
    });

    it('should throw LlmError if LLM API call times out', async () => {
      const prompt = 'Test prompt';
      const error = createAxiosError(0, 'ETIMEDOUT'); // Simulate timeout
      mockHttpService.post.mockReturnValue(throwError(() => error));

      await expect(provider.generateTextResponse(prompt)).rejects.toThrow(
        expect.objectContaining({
          type: 'TIMEOUT', // Correctly classified
          message: 'Internal LLM API Error: Request timed out.',
        }),
      );
    });

    it('should propagate errors from getToken', async () => {
      // Override default token mock to throw error
      const tokenError = new LlmError('Token fetch failed', 'INVALID_CONFIG');
      jest.spyOn(provider as any, 'getToken').mockRejectedValue(tokenError);

      await expect(provider.generateTextResponse('prompt')).rejects.toThrow(
        tokenError,
      );
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });

  describe('generateJsonResponse', () => {
    beforeEach(() => {
      // Mock successful token retrieval
      mockCacheManager.get.mockResolvedValue(FAKE_TOKEN);
    });

    it('should call LLM API with json_mode and return JSON object', async () => {
      const prompt = 'Test JSON prompt';
      const expectedResponse = { data: 'test', value: 123 };
      mockHttpService.post.mockReturnValue(
        of(createAxiosResponse(expectedResponse)), // API returns the JSON directly
      );

      const result = await provider.generateJsonResponse(prompt);

      expect(result).toEqual(expectedResponse);
      expect(httpService.post).toHaveBeenCalledWith(
        FAKE_LLM_URL,
        {
          prompt: prompt,
          json_mode: true,
        },
        {
          headers: { Authorization: `Bearer ${FAKE_TOKEN}` },
        },
      );
    });

    it('should include other options in JSON request', async () => {
      const prompt = 'Test JSON prompt';
      const options = {
        temperature: 0.6,
        systemPrompt: 'Sys JSON',
        maxTokens: 200,
      };
      const expectedResponse = { data: 'test' };
      mockHttpService.post.mockReturnValue(
        of(createAxiosResponse(expectedResponse)),
      );

      await provider.generateJsonResponse(prompt, options);

      expect(httpService.post).toHaveBeenCalledWith(
        FAKE_LLM_URL,
        {
          prompt: prompt,
          json_mode: true,
          temperature: options.temperature,
          system_prompt: options.systemPrompt,
          max_tokens: options.maxTokens,
        },
        { headers: { Authorization: `Bearer ${FAKE_TOKEN}` } },
      );
    });

    it('should throw LlmError if LLM API returns non-object for JSON', async () => {
      const prompt = 'Test JSON prompt';
      mockHttpService.post.mockReturnValue(
        of(createAxiosResponse('not an object')), // Invalid response type
      );

      await expect(provider.generateJsonResponse(prompt)).rejects.toThrow(
        new LlmError(
          'Internal LLM returned non-object response for JSON request.',
          'RESPONSE_FORMAT',
        ),
      );
    });

    it('should throw LlmError if LLM API call fails (AxiosError)', async () => {
      const prompt = 'Test JSON prompt';
      const apiErrorResponse = createAxiosResponse(
        { error: 'Bad Request' },
        400,
      );
      const error = createAxiosError(400, 'BAD_REQUEST', apiErrorResponse);
      mockHttpService.post.mockReturnValue(throwError(() => error));

      await expect(provider.generateJsonResponse(prompt)).rejects.toThrow(
        expect.objectContaining({
          type: 'API_ERROR',
          message: expect.stringContaining(
            'Internal LLM API Error (generateJsonResponse): 400 BAD_REQUEST',
          ),
        }),
      );
    });

    it('should propagate errors from getToken', async () => {
      const tokenError = new LlmError('Token fetch failed', 'INVALID_CONFIG');
      jest.spyOn(provider as any, 'getToken').mockRejectedValue(tokenError);

      await expect(provider.generateJsonResponse('prompt')).rejects.toThrow(
        tokenError,
      );
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });
});
