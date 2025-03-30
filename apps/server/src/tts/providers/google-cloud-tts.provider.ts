import { Injectable, Logger } from '@nestjs/common';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { google } from '@google-cloud/text-to-speech/build/protos/protos'; // For type hints
import {
  ITtsProvider,
  ProviderTtsOptions,
} from '../interfaces/itts-provider.interface';
import { TtsError } from '../errors/tts.error';

// Define Google Cloud specific voice names mapped from application names
// Find available voices: https://cloud.google.com/text-to-speech/docs/voices
// These are example mappings, adjust as needed.
const GOOGLE_VOICE_MAP: Record<'Ash' | 'Jenny', string> = {
  Ash: 'en-US-Standard-D', // Example standard male voice
  Jenny: 'en-US-Neural2-F', // Example neural female voice
};

// Define Google Cloud voice gender mapping (used if only languageCode is provided)
// Note: SsmlVoiceGender seems deprecated or incorrectly typed in some versions, using string as fallback
const GOOGLE_GENDER_MAP: Record<'Ash' | 'Jenny', 'MALE' | 'FEMALE'> = {
  Ash: 'MALE',
  Jenny: 'FEMALE',
};

@Injectable()
export class GoogleCloudTtsProvider implements ITtsProvider {
  private readonly logger = new Logger(GoogleCloudTtsProvider.name);
  private readonly client: TextToSpeechClient;

  constructor() {
    // Assumes ADC (Application Default Credentials) are configured.
    try {
      this.client = new TextToSpeechClient();
      this.logger.log(
        'Initialized GoogleCloudTtsProvider using Application Default Credentials.',
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize Google Cloud TTS Client: ${error.message}`,
        error.stack,
      );
      // Ensure error is an instance of Error for consistent handling
      const err = error instanceof Error ? error : new Error(String(error));
      throw new TtsError(
        `Failed to initialize Google Cloud TTS Client: ${err.message}`,
        err,
      );
    }
  }

  /**
   * Maps application voice ('Ash', 'Jenny') to Google Cloud specific voice name.
   */
  mapAppVoiceToGoogle(appVoice: 'Ash' | 'Jenny'): string {
    const googleVoice = GOOGLE_VOICE_MAP[appVoice];
    if (!googleVoice) {
      this.logger.error(
        `No Google Cloud voice mapping found for app voice: ${appVoice}`,
      );
      throw new TtsError(
        `Unsupported application voice for Google Cloud TTS: ${appVoice}`,
      );
    }
    return googleVoice;
  }

  async generateSpeech(
    text: string,
    options: ProviderTtsOptions,
  ): Promise<Buffer> {
    // Default language and speed, let Google handle defaults if totally unspecified
    const { providerVoiceId, languageCode = 'en-US', speed = 1.0 } = options;

    // Google uses 'speakingRate' (0.25 to 4.0, 1.0 is normal)
    const speakingRate = Math.max(0.25, Math.min(4.0, speed));

    const request: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: { text: text },
      voice: {
        name: providerVoiceId,
        languageCode: languageCode,
      },
      audioConfig: {
        audioEncoding: 'MP3', // Use string enum value 'MP3'
        speakingRate: speakingRate,
      },
    };

    this.logger.log(
      `Generating speech with Google Cloud TTS: Voice=${providerVoiceId}, Lang=${languageCode}, Rate=${speakingRate}`,
    );

    try {
      const [response] = await this.client.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new TtsError('Google Cloud TTS returned empty audio content.');
      }

      // --- Refined Buffer Handling ---
      let audioBuffer: Buffer;
      if (response.audioContent instanceof Buffer) {
        audioBuffer = response.audioContent;
      } else if (typeof response.audioContent === 'string') {
        // Assume base64 encoding if it's a string
        audioBuffer = Buffer.from(response.audioContent, 'base64');
      } else if (response.audioContent instanceof Uint8Array) {
        // Buffer.from can handle Uint8Array directly
        audioBuffer = Buffer.from(response.audioContent);
      } else {
        // Should not happen based on types, but throw error for safety
        this.logger.error(
          `Unexpected audioContent type from Google TTS: ${typeof response.audioContent}`,
        );
        throw new TtsError(
          'Received unexpected audio content type from Google Cloud TTS.',
        );
      }
      // --- End Refined Buffer Handling ---

      this.logger.log(
        `Successfully generated speech buffer (${audioBuffer.length} bytes) with Google Cloud TTS.`,
      );

      return audioBuffer;
    } catch (error) {
      this.logger.error(
        `Google Cloud TTS API request failed: ${error.message}`,
        error.stack,
      );
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // Ensure error is an instance of Error for consistent handling
      const err = error instanceof Error ? error : new Error(errorMessage);
      throw new TtsError(
        `Failed to generate speech using Google Cloud TTS: ${errorMessage}`,
        err,
      );
    }
  }
}
