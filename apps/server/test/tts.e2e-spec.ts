import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module'; // Import main AppModule
import { TtsService } from '../src/tts/tts.service';
import { TtsError } from '../src/tts/errors/tts.error';
import { ConfigService } from '@nestjs/config';

// Increase Jest timeout for potentially longer API calls
jest.setTimeout(30000); // 30 seconds

describe('TtsService (Integration - OpenAI API Call)', () => {
  let app: INestApplication;
  let ttsService: TtsService;
  let configService: ConfigService;
  let shouldRunTests = true; // Flag to control test execution

  beforeAll(async () => {
    // Check for API key before setting up the module to provide a clearer early error
    const tempConfigService = new ConfigService(); // Use directly for pre-check
    const apiKey = tempConfigService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      console.error(
        'TEST SETUP SKIPPED: OPENAI_API_KEY environment variable not set. This test requires a valid OpenAI API key.',
      );
      shouldRunTests = false;
      return; // Stop setup if key is missing
    }
    const ttsProvider = tempConfigService.get<string>('TTS_PROVIDER');
    if (ttsProvider && ttsProvider.toLowerCase() !== 'openai') {
      console.warn(
        `TEST SETUP SKIPPED: Skipping TTS integration test because TTS_PROVIDER is set to '${ttsProvider}' (requires 'openai' or unset).`,
      );
      shouldRunTests = false;
      return; // Stop setup if provider is wrong
    }

    // Proceed with module compilation only if checks passed
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // Use the main AppModule which imports TtsModule.forRoot()
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    ttsService = moduleFixture.get<TtsService>(TtsService);
    configService = moduleFixture.get<ConfigService>(ConfigService); // Get ConfigService if needed for checks
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // Use describe.skipIf or it.skip based on the flag
  const describeOrSkip = shouldRunTests ? describe : describe.skip;

  describeOrSkip('API Calls', () => {
    it('should generate speech using OpenAI API and return a non-empty MP3 buffer for voice "Ash"', async () => {
      const testText = 'Hello world, this is Ash speaking.';
      try {
        const audioBuffer = await ttsService.generateSpeech(testText, {
          voice: 'Ash',
        });

        expect(audioBuffer).toBeInstanceOf(Buffer);
        expect(audioBuffer.length).toBeGreaterThan(1000); // Expect a reasonable buffer size for MP3

        // Optional: Verify MP3 magic number (first few bytes) if needed, though less critical for integration
        // const magicNumber = audioBuffer.toString('hex', 0, 3);
        // expect(magicNumber).toMatch(/^fffb|^494433/); // ID3 tags or frame sync
      } catch (error) {
        // Log the error for easier debugging if the API call fails
        console.error('OpenAI TTS API call failed during test:', error);
        if (error instanceof TtsError && error.cause) {
          console.error('Original Cause:', error.cause);
        }
        // Fail the test explicitly if an error occurs
        throw error;
      }
    });

    it('should generate speech using OpenAI API and return a non-empty MP3 buffer for voice "Jenny"', async () => {
      const testText = 'Hello world, this is Jenny speaking.';
      try {
        const audioBuffer = await ttsService.generateSpeech(testText, {
          voice: 'Jenny',
        });

        expect(audioBuffer).toBeInstanceOf(Buffer);
        expect(audioBuffer.length).toBeGreaterThan(1000);
      } catch (error) {
        console.error('OpenAI TTS API call failed during test:', error);
        if (error instanceof TtsError && error.cause) {
          console.error('Original Cause:', error.cause);
        }
        throw error;
      }
    });

    it('should throw TtsError for invalid application voice', async () => {
      const testText = 'This should fail.';
      // Need to cast because 'InvalidVoice' is not assignable to 'Ash' | 'Jenny'
      const options = { voice: 'InvalidVoice' as 'Ash' | 'Jenny' };

      await expect(
        ttsService.generateSpeech(testText, options),
      ).rejects.toThrow(TtsError);
      await expect(
        ttsService.generateSpeech(testText, options),
      ).rejects.toThrow(/Invalid voice name specified: InvalidVoice/);
    });
  });
});
