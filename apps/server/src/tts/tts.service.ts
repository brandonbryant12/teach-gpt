import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  ITtsProvider,
  TTS_PROVIDER_SERVICE,
  ProviderTtsOptions,
} from './interfaces/itts-provider.interface';
import { TtsGenerationOptions } from './dto/tts-generation-options.dto';
import { TtsError } from './errors/tts.error';
import { ConfigService } from '@nestjs/config';
// Import providers if accessing their specific methods (not needed for current mapping)
// import { AzureTtsProvider } from './providers/azure-tts.provider';
// import { GoogleCloudTtsProvider } from './providers/google-cloud-tts.provider';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  // Store provider name to help with voice mapping logic if needed
  private readonly activeProviderName: string;

  constructor(
    @Inject(TTS_PROVIDER_SERVICE) private readonly ttsProvider: ITtsProvider,
    private readonly configService: ConfigService, // Inject ConfigService
  ) {
    // Determine the active provider for potential future mapping logic expansions
    this.activeProviderName = (
      this.configService.get<string>('TTS_PROVIDER') || 'openai'
    ).toLowerCase();
    this.logger.log(
      `Initialized TtsService with provider: ${this.activeProviderName}`,
    );
  }

  /**
   * Generates speech audio buffer using the configured TTS provider.
   * Maps application-defined voices ("Ash", "Jenny") to provider-specific IDs.
   *
   * @param text The text content to synthesize.
   * @param options Options for speech generation, including the voice ('Ash' or 'Jenny').
   * @returns A Promise resolving with a Node.js Buffer containing the MP3 audio data.
   * @throws {TtsError} if voice mapping fails or the provider fails.
   */
  async generateSpeech(
    text: string,
    options: TtsGenerationOptions,
  ): Promise<Buffer> {
    const { voice, languageCode, speed } = options;
    this.logger.log(`Received request to generate speech for voice: ${voice}`);

    let providerVoiceId: string;

    // --- Voice Mapping Logic ---
    switch (this.activeProviderName) {
      case 'openai':
        providerVoiceId = this.mapVoiceToOpenAI(voice);
        break;
      case 'azure':
        providerVoiceId = this.mapVoiceToAzure(voice);
        break;
      // --- Add Google Mapping Case ---
      case 'google':
        providerVoiceId = this.mapVoiceToGoogle(voice);
        break;
      default:
        this.logger.error(
          `Unsupported TTS provider configured for voice mapping: ${this.activeProviderName}`,
        );
        throw new TtsError(
          `Voice mapping not implemented for provider: ${this.activeProviderName}`,
        );
    }
    // --- End Voice Mapping ---

    const providerOptions: ProviderTtsOptions = {
      providerVoiceId,
      languageCode, // Pass language, provider can handle defaults
      speed, // Pass speed, provider handles conversion/validation
      audioFormat: 'mp3',
    };

    try {
      this.logger.log(
        `Calling ${this.activeProviderName} provider with voice ID: ${providerVoiceId}`,
      );
      const audioBuffer = await this.ttsProvider.generateSpeech(
        text,
        providerOptions,
      );
      this.logger.log(
        `Successfully received audio buffer (${audioBuffer.length} bytes) from provider.`,
      );
      return audioBuffer;
    } catch (error) {
      this.logger.error(
        `TTS generation failed for voice ${voice} using provider ${this.activeProviderName}: ${error.message}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Re-throw as TtsError or allow specific provider errors if needed
      if (error instanceof TtsError) {
        throw error;
      }
      // Ensure the original error cause is passed along
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new TtsError(
        `TTS provider (${this.activeProviderName}) failed during speech generation: ${errorMessage}`,
        error instanceof Error ? error : new Error(errorMessage),
      );
    }
  }

  /**
   * Maps application voice names to OpenAI specific voice IDs.
   * @param appVoice - 'Ash' or 'Jenny'
   * @returns OpenAI voice ID ('onyx' or 'nova')
   * @throws {TtsError} if the voice name is invalid.
   */
  private mapVoiceToOpenAI(appVoice: 'Ash' | 'Jenny'): string {
    // Simplified - relies on type safety
    const map = { Ash: 'onyx', Jenny: 'nova' };
    const voiceId = map[appVoice];
    if (!voiceId)
      throw new TtsError(`Invalid OpenAI voice name specified: ${appVoice}`);
    return voiceId;
  }

  // --- Add Azure Voice Mapping Method ---
  private mapVoiceToAzure(appVoice: 'Ash' | 'Jenny'): string {
    const AZURE_VOICE_MAP: Record<'Ash' | 'Jenny', string> = {
      Ash: 'en-US-DavisNeural',
      Jenny: 'en-US-JennyNeural',
    };
    const azureVoice = AZURE_VOICE_MAP[appVoice];
    if (!azureVoice) {
      this.logger.error(
        `No Azure voice mapping found in TtsService for app voice: ${appVoice}`,
      );
      // This case should also not be hit due to type checking, but throw for safety
      throw new TtsError(
        `Unsupported application voice for Azure TTS: ${appVoice}`,
      );
    }
    return azureVoice;
  }

  // --- Add Google Voice Mapping Method ---
  private mapVoiceToGoogle(appVoice: 'Ash' | 'Jenny'): string {
    // Simplified
    const map = { Ash: 'en-US-Standard-D', Jenny: 'en-US-Neural2-F' };
    const voiceId = map[appVoice];
    if (!voiceId)
      throw new TtsError(
        `Unsupported application voice for Google Cloud TTS: ${appVoice}`,
      );
    return voiceId;
  }
}
