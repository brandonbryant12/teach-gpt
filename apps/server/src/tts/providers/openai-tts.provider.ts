import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
// Removed Readable import as it's not directly used for Buffer conversion
import {
  ITtsProvider,
  ProviderTtsOptions,
} from '../interfaces/itts-provider.interface';
import { TtsError } from '../errors/tts.error';

// --- Add OpenAI Voice Map ---
// Use correct string literal type for voices
const OPENAI_VOICE_MAP: Record<'Ash' | 'Jenny', 'onyx' | 'nova'> = {
  Ash: 'onyx',
  Jenny: 'nova',
};

// Define the specific type for OpenAI voices used in this app
type OpenAiVoice = 'onyx' | 'nova';

@Injectable()
export class OpenAiTtsProvider implements ITtsProvider {
  private readonly logger = new Logger(OpenAiTtsProvider.name);
  private readonly openai: OpenAI;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    const apiKeyFromConfig = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKeyFromConfig) {
      this.logger.error('OPENAI_API_KEY is not configured.');
      throw new TtsError(
        'OpenAI API key is missing in environment configuration.',
      );
    }
    this.apiKey = apiKeyFromConfig;
    this.openai = new OpenAI({ apiKey: this.apiKey });
  }

  // --- Add OpenAI Voice Mapping Method (similar to Azure) ---
  /**
   * Maps application voice ('Ash', 'Jenny') to OpenAI-specific voice ID.
   * Note: The main mapping currently happens in TtsService. This is for consistency/reference.
   * @param appVoice - 'Ash' or 'Jenny'
   * @returns OpenAI voice ID ('onyx' or 'nova')
   * @throws {TtsError} if the voice name is invalid.
   */
  mapAppVoiceToOpenAI(appVoice: 'Ash' | 'Jenny'): OpenAiVoice {
    const openaiVoice = OPENAI_VOICE_MAP[appVoice];
    if (!openaiVoice) {
      this.logger.error(
        `No OpenAI voice mapping found for app voice: ${appVoice}`,
      );
      throw new TtsError(
        `Unsupported application voice for OpenAI TTS: ${appVoice}`,
      );
    }
    return openaiVoice;
  }

  /**
   * Generates speech using the OpenAI TTS API.
   * @param text The text to synthesize.
   * @param options Options containing the provider-specific voice ID ('onyx' or 'nova').
   * @returns A Promise resolving with a Node.js Buffer containing the MP3 audio data.
   * @throws {TtsError} if speech generation fails.
   */
  async generateSpeech(
    text: string,
    options: ProviderTtsOptions,
  ): Promise<Buffer> {
    const { providerVoiceId, speed } = options;

    // Validate voice ID for OpenAI (using the defined map values)
    const validVoices = Object.values(OPENAI_VOICE_MAP);
    // Use type assertion for the check
    if (!validVoices.includes(providerVoiceId as OpenAiVoice)) {
      this.logger.error(`Invalid OpenAI voice ID received: ${providerVoiceId}`);
      throw new TtsError(
        `Invalid voice ID for OpenAI TTS provider: ${providerVoiceId}. Must be one of ${validVoices.join(', ')}.`,
      );
    }

    try {
      this.logger.log(
        `Generating speech with OpenAI TTS: Voice=${providerVoiceId}, Speed=${speed ?? 'default'}`,
      );

      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        // Use type assertion for the parameter
        voice: providerVoiceId as OpenAiVoice,
        input: text,
        response_format: 'mp3',
        speed: speed,
      });

      // The SDK returns a Response object. Get the ArrayBuffer and convert to Node.js Buffer.
      const arrayBuffer = await mp3.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      this.logger.log(
        `Successfully generated speech buffer (${buffer.length} bytes) with OpenAI TTS.`,
      );
      return buffer;
    } catch (error) {
      this.logger.error(
        `OpenAI TTS API request failed: ${error.message}`,
        error.stack,
      );
      // Ensure the thrown error includes the original error cause if available
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new TtsError(
        `Failed to generate speech using OpenAI TTS: ${errorMessage}`,
        error instanceof Error ? error : new Error(errorMessage),
      );
    }
  }
}
