import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';

import { GoogleAiProvider } from './google-ai.provider'; // Corrected casing
import { LlmGenerationOptions } from '../llm.options';

// Helper to check if API key is available
const apiKey = process.env.GOOGLE_API_KEY;
const describeOrSkip = apiKey ? describe : describe.skip;

describeOrSkip('GoogleAiProvider (Integration)', () => {
  // Corrected casing
  let provider: GoogleAiProvider; // Corrected casing
  let configService: ConfigService;

  beforeAll(() => {
    if (!apiKey) {
      console.warn(
        'Skipping GoogleAIProvider integration tests: GOOGLE_API_KEY environment variable not set.',
      );
    }
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule, CacheModule.register()],
      providers: [
        GoogleAiProvider, // Corrected casing
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GOOGLE_API_KEY') return apiKey;
              if (key === 'GOOGLE_AI_DEFAULT_MODEL') return 'gemini-1.5-flash'; // Use a reasonable default/test model
              return process.env[key];
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'GOOGLE_API_KEY') {
                if (!apiKey) throw new Error('Missing GOOGLE_API_KEY');
                return apiKey;
              }
              if (key === 'GOOGLE_AI_DEFAULT_MODEL') return 'gemini-1.5-flash';
              const value = process.env[key];
              if (value === undefined)
                throw new Error(`Missing env var: ${key}`);
              return value;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<GoogleAiProvider>(GoogleAiProvider); // Corrected casing
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('generateTextResponse', () => {
    it('should call the real Google AI API and return a non-empty text response', async () => {
      const prompt =
        'This is an integration test. Respond with a short confirmation.';
      const result = await provider.generateTextResponse(prompt, {
        modelOverride: 'gemini-1.5-flash', // Specify the model if needed, or let provider use default
        maxTokens: 50,
        temperature: 0.1,
      });

      console.log('Google AI API Response:', result); // Log response for debugging

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }, 30000); // Increase timeout for real API call
  });

  // Add tests for other methods like generateJsonResponse if applicable
});
