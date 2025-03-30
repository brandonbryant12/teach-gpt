import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './../src/app.module'; // Adjust path if your root AppModule is elsewhere
import { LlmService } from './../src/llm/llm.service';
import { LlmError } from './../src/llm/llm.error';

// Increase timeout for potentially slow LLM API calls
jest.setTimeout(60000); // 60 seconds

describe('LlmService (e2e)', () => {
  let app: INestApplication;
  let llmService: LlmService;
  let configService: ConfigService;
  let currentProvider: string | undefined;

  beforeAll(async () => {
    // Consider loading a .env.test file here if you use one
    // Example: dotenv.config({ path: '.env.test' });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // Import your main application module
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    llmService = moduleFixture.get<LlmService>(LlmService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
    currentProvider = configService.get<string>('LLM_PROVIDER');

    // Log the provider being tested
    console.log(
      `\n[LLM E2E Test] Running tests for provider: ${currentProvider || '(Defaulting to openai)'}`, // Log default if not set
    );
    // Check essential keys based on the *intended* provider for this run
    if (currentProvider === 'openai' && !configService.get('OPENAI_API_KEY')) {
      console.warn(
        '[LLM E2E Test] Skipping OpenAI tests: OPENAI_API_KEY not set.',
      );
    }
    if (
      currentProvider === 'google-ai' &&
      !configService.get('GOOGLE_API_KEY')
    ) {
      console.warn(
        '[LLM E2E Test] Skipping Google AI tests: GOOGLE_API_KEY not set.',
      );
    }
    if (
      currentProvider === 'internal' &&
      (!configService.get('INTERNAL_TOKEN_URL') ||
        !configService.get('INTERNAL_LLM_URL'))
    ) {
      console.warn(
        '[LLM E2E Test] Skipping Internal tests: INTERNAL_TOKEN_URL or INTERNAL_LLM_URL not set.',
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper function to check if the current test run should be skipped
  const shouldSkip = (providerToCheck: string): boolean => {
    if (currentProvider !== providerToCheck) return true; // Skip if not the configured provider

    switch (providerToCheck) {
      case 'openai':
        return !configService.get('OPENAI_API_KEY');
      case 'google-ai':
        return !configService.get('GOOGLE_API_KEY');
      case 'internal':
        return (
          !configService.get('INTERNAL_TOKEN_URL') ||
          !configService.get('INTERNAL_LLM_URL')
        );
      default:
        return true; // Skip unknown providers
    }
  };

  describe('generateTextResponse', () => {
    const testFn = async () => {
      const prompt = 'What is the capital of France?';
      try {
        const response = await llmService.generateTextResponse(prompt, {
          maxTokens: 50, // Keep requests small
        });
        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
        // Basic check for relevance (optional, can be brittle)
        expect(response.toLowerCase()).toContain('paris');
        console.log(
          `[LLM E2E Test - ${currentProvider}] Text Response: ${response.substring(0, 50)}...`,
        );
      } catch (error) {
        if (error instanceof LlmError) {
          console.error(
            `[LLM E2E Test - ${currentProvider}] LlmError: ${error.message} (Type: ${error.type})`,
          );
        } else {
          console.error(
            `[LLM E2E Test - ${currentProvider}] Unknown Error: ${error}`,
          );
        }
        // Re-throw to fail the test, but after logging details
        throw error;
      }
    };

    // Conditionally run tests based on configured provider and available keys
    it('should get a text response from OpenAI', async () => {
      if (shouldSkip('openai')) {
        console.warn('[LLM E2E Test] Skipping OpenAI text test.');
        return;
      }
      await testFn();
    });

    it('should get a text response from Google AI', async () => {
      if (shouldSkip('google-ai')) {
        console.warn('[LLM E2E Test] Skipping Google AI text test.');
        return;
      }
      await testFn();
    });

    it('should get a text response from Internal Provider', async () => {
      if (shouldSkip('internal')) {
        console.warn('[LLM E2E Test] Skipping Internal text test.');
        return;
      }
      await testFn();
    });
  });

  describe('generateJsonResponse', () => {
    interface SimpleJsonResponse {
      capital: string;
      country: string;
    }

    const testFn = async () => {
      const prompt =
        'Return a JSON object with the capital of Germany. Use keys "capital" and "country".';
      try {
        const response =
          await llmService.generateJsonResponse<SimpleJsonResponse>(prompt, {
            maxTokens: 100,
          });
        expect(response).toBeDefined();
        expect(typeof response).toBe('object');
        expect(response).toHaveProperty('capital');
        expect(response).toHaveProperty('country');
        expect(typeof response.capital).toBe('string');
        expect(typeof response.country).toBe('string');
        expect(response.capital.toLowerCase()).toContain('berlin');
        expect(response.country.toLowerCase()).toContain('germany');
        console.log(
          `[LLM E2E Test - ${currentProvider}] JSON Response: ${JSON.stringify(response)}`,
        );
      } catch (error) {
        if (error instanceof LlmError) {
          console.error(
            `[LLM E2E Test - ${currentProvider}] LlmError: ${error.message} (Type: ${error.type})`,
          );
        } else {
          console.error(
            `[LLM E2E Test - ${currentProvider}] Unknown Error: ${error}`,
          );
        }
        throw error;
      }
    };

    it('should get a JSON response from OpenAI', async () => {
      if (shouldSkip('openai')) {
        console.warn('[LLM E2E Test] Skipping OpenAI JSON test.');
        return;
      }
      // Note: Ensure the model used by default or override supports JSON mode well (e.g., gpt-4o)
      await testFn();
    });

    it('should get a JSON response from Google AI', async () => {
      if (shouldSkip('google-ai')) {
        console.warn('[LLM E2E Test] Skipping Google AI JSON test.');
        return;
      }
      // Note: Ensure the model used supports JSON output (responseMimeType)
      await testFn();
    });

    it('should get a JSON response from Internal Provider', async () => {
      if (shouldSkip('internal')) {
        console.warn('[LLM E2E Test] Skipping Internal JSON test.');
        return;
      }
      // Note: Assumes internal provider API handles JSON request/response
      await testFn();
    });
  });

  // Add more tests as needed, e.g., for error handling, different options
});
