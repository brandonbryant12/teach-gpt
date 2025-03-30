import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAiTtsProvider } from './openai-tts.provider';
import { TtsError } from '../errors/tts.error';
import { ProviderTtsOptions } from '../interfaces/itts-provider.interface';

// Increase Jest timeout for API calls
jest.setTimeout(30000); // 30 seconds

// Helper to check if API key is available directly from process.env
const apiKey = process.env.OPENAI_API_KEY;
const describeOrSkip = apiKey ? describe : describe.skip;

describeOrSkip('OpenAiTtsProvider (Integration with Mocked Config)', () => {
  let provider: OpenAiTtsProvider;
  let configService: ConfigService; // Keep for type checking if needed
  let module: TestingModule;

  beforeAll(() => {
    // Optional: Add a warning if the key is missing
    if (!apiKey) {
      console.warn(
        'Skipping OpenAiTtsProvider integration tests: OPENAI_API_KEY environment variable not set.',
      );
    }
  });

  beforeEach(async () => {
    // Skip module setup if key is missing (describeOrSkip handles test execution)
    if (!apiKey) return;

    module = await Test.createTestingModule({
      // Remove imports array for ConfigModule
      providers: [
        OpenAiTtsProvider, // Provide the actual provider
        {
          provide: ConfigService,
          // Provide a mock implementation using the apiKey from process.env
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') return apiKey;
              // Add other necessary config gets if the provider uses them
              return process.env[key]; // Fallback to process.env if needed
            }),
            // Add getOrThrow if your provider uses it
            getOrThrow: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') {
                if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
                return apiKey;
              }
              // Add other necessary config getOrThrows
              const value = process.env[key];
              if (value === undefined)
                throw new Error(`Missing env var: ${key}`);
              return value;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<OpenAiTtsProvider>(OpenAiTtsProvider);
    // configService = module.get<ConfigService>(ConfigService); // Can still get the mock if needed
  });

  // Tests remain inside the describeOrSkip block

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should generate speech and return a non-empty MP3 buffer for voice "onyx"', async () => {
    const testText = 'Hello world, this is an integration test using onyx.';
    const options: ProviderTtsOptions = { providerVoiceId: 'onyx' };

    try {
      const audioBuffer = await provider.generateSpeech(testText, options);

      expect(audioBuffer).toBeInstanceOf(Buffer);
      expect(audioBuffer.length).toBeGreaterThan(1000); // Expect a reasonable size
      console.log(
        `OpenAI TTS (onyx) integration test succeeded. Buffer size: ${audioBuffer.length}`,
      );
    } catch (error) {
      console.error('OpenAI TTS (onyx) integration test failed:', error);
      if (error instanceof TtsError && error.cause) {
        console.error('Original Cause:', error.cause);
      }
      throw error; // Fail the test if API call fails
    }
  });

  it('should generate speech and return a non-empty MP3 buffer for voice "nova"', async () => {
    const testText = 'Hello world, this is an integration test using nova.';
    const options: ProviderTtsOptions = { providerVoiceId: 'nova', speed: 1.1 }; // Test speed option

    try {
      const audioBuffer = await provider.generateSpeech(testText, options);

      expect(audioBuffer).toBeInstanceOf(Buffer);
      expect(audioBuffer.length).toBeGreaterThan(1000);
      console.log(
        `OpenAI TTS (nova) integration test succeeded. Buffer size: ${audioBuffer.length}`,
      );
    } catch (error) {
      console.error('OpenAI TTS (nova) integration test failed:', error);
      if (error instanceof TtsError && error.cause) {
        console.error('Original Cause:', error.cause);
      }
      throw error;
    }
  });

  // This test remains valid as it checks internal validation before an API call
  it('should throw TtsError for invalid providerVoiceId without calling API', async () => {
    const options: ProviderTtsOptions = { providerVoiceId: 'invalid-voice' };
    const testText = 'This should not be synthesized.';

    await expect(provider.generateSpeech(testText, options)).rejects.toThrow(
      TtsError,
    );
    await expect(provider.generateSpeech(testText, options)).rejects.toThrow(
      /Invalid voice ID for OpenAI TTS provider: invalid-voice/,
    );
  });

  // Note: Testing specific API error scenarios (e.g., rate limits, auth errors)
  // in integration tests can be difficult without specific setup or intentionally
  // providing invalid credentials just for a test case, which is often not practical.
  // The happy path tests provide good coverage for basic integration.
});
