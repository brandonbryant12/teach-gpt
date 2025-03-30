import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';

import { OpenAiProvider } from './openai.provider';

// Helper to check if API key is available
const apiKey = process.env.OPENAI_API_KEY;
const describeOrSkip = apiKey ? describe : describe.skip;

describeOrSkip('OpenaiProvider (Integration)', () => {
  let provider: OpenAiProvider;

  beforeAll(() => {
    // Optional: Add a warning if the key is missing, explaining why tests are skipped.
    if (!apiKey) {
      console.warn(
        'Skipping OpenaiProvider integration tests: OPENAI_API_KEY environment variable not set.',
      );
    }
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule, CacheModule.register()],
      providers: [
        OpenAiProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') return apiKey;
              if (key === 'OPENAI_DEFAULT_MODEL') return 'gpt-4o'; // Provide a default for testing
              return process.env[key];
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') {
                if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
                return apiKey;
              }
              if (key === 'OPENAI_DEFAULT_MODEL') return 'gpt-4o'; // Provide a default for testing
              const value = process.env[key];
              if (value === undefined)
                throw new Error(`Missing env var: ${key}`); // Check for undefined specifically
              return value;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<OpenAiProvider>(OpenAiProvider);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('generateTextResponse', () => {
    it('should call the real OpenAI API and return a non-empty text response', async () => {
      const prompt =
        'This is an integration test. Respond with a short confirmation.';
      const result = await provider.generateTextResponse(prompt, {
        maxTokens: 50,
        temperature: 0.1,
      });

      console.log('OpenAI API Response:', result); // Log response for debugging

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }, 30000);
  });

  // Add more tests for other methods (e.g., generateChatResponse) if needed
  // describe('generateChatResponse', () => {
  //   it('should call the real OpenAI API and return a non-empty chat response', async () => {
  //     const messages = [{ role: 'user', content: 'Hello!' }];
  //     const result = await provider.generateChatResponse(messages, {
  //       model: 'gpt-3.5-turbo',
  //       maxTokens: 50,
  //       temperature: 0.1,
  //     });
  //     console.log('OpenAI API Chat Response:', result);
  //     expect(typeof result).toBe('string');
  //     expect(result.length).toBeGreaterThan(0);
  //   }, 30000);
  // });
});
