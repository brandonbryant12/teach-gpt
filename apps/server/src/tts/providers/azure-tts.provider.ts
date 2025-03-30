import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { PassThrough } from 'stream'; // Although PassThrough isn't used directly now, keep it for potential future stream handling
import {
  ITtsProvider,
  ProviderTtsOptions,
} from '../interfaces/itts-provider.interface';
import { TtsError } from '../errors/tts.error';

// Define Azure-specific voice names mapped from application names
// These names must match valid Azure TTS voice names.
// Find available voices: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts
const AZURE_VOICE_MAP: Record<'Ash' | 'Jenny', string> = {
  Ash: 'en-US-DavisNeural', // Example: Male voice
  Jenny: 'en-US-JennyNeural', // Example: Standard Jenny voice
};

@Injectable()
export class AzureTtsProvider implements ITtsProvider {
  private readonly logger = new Logger(AzureTtsProvider.name);
  private readonly speechKey: string;
  private readonly speechRegion: string;

  constructor(private readonly configService: ConfigService) {
    const keyFromConfig = this.configService.get<string>('AZURE_SPEECH_KEY');
    const regionFromConfig = this.configService.get<string>(
      'AZURE_SPEECH_REGION',
    );

    if (!keyFromConfig || !regionFromConfig) {
      this.logger.error(
        'Azure Speech Key or Region is not configured in environment variables (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION).',
      );
      throw new TtsError(
        'Azure TTS provider configuration is missing (Key or Region).',
      );
    }
    this.speechKey = keyFromConfig;
    this.speechRegion = regionFromConfig;

    this.logger.log(
      `Initialized AzureTtsProvider for region: ${this.speechRegion}`,
    );
  }

  /**
   * Maps application voice ('Ash', 'Jenny') to Azure-specific voice name.
   * Note: This mapping is also present in TtsService for now.
   * Consider refactoring to a central mapping service if complexity grows.
   */
  mapAppVoiceToAzure(appVoice: 'Ash' | 'Jenny'): string {
    const azureVoice = AZURE_VOICE_MAP[appVoice];
    if (!azureVoice) {
      this.logger.error(
        `No Azure voice mapping found for app voice: ${appVoice}`,
      );
      throw new TtsError(
        `Unsupported application voice for Azure TTS: ${appVoice}`,
      );
    }
    return azureVoice;
  }

  async generateSpeech(
    text: string,
    options: ProviderTtsOptions,
  ): Promise<Buffer> {
    const { providerVoiceId, languageCode, speed } = options; // providerVoiceId is the Azure voice name here

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      this.speechKey,
      this.speechRegion,
    );

    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    if (languageCode) {
      speechConfig.speechSynthesisLanguage = languageCode;
    }

    let rateAttribute = 'medium'; // Default
    if (speed !== undefined) {
      if (speed < 0.7) rateAttribute = 'x-slow';
      else if (speed < 0.9) rateAttribute = 'slow';
      else if (speed > 1.5) rateAttribute = 'x-fast';
      else if (speed > 1.1) rateAttribute = 'fast';
    }
    const rateSsml = `rate="${rateAttribute}"`;

    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${languageCode || 'en-US'}">
        <voice name="${providerVoiceId}">
          <prosody ${rateSsml}>
            ${text}
          </prosody>
        </voice>
      </speak>
    `;

    this.logger.log(
      `Generating speech with Azure TTS: Voice=${providerVoiceId}, Rate=${rateAttribute}, Lang=${languageCode || 'default'}`,
    );

    return new Promise((resolve, reject) => {
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig, undefined);

      synthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          synthesizer.close();

          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            this.logger.log(
              `Azure TTS synthesis completed. Audio size: ${result.audioData.byteLength} bytes.`,
            );
            resolve(Buffer.from(result.audioData));
          } else {
            const errorDetails = sdk.CancellationDetails.fromResult(result);
            const errorMessage = `Azure TTS failed: ${result.reason}${errorDetails ? ` - ${errorDetails.errorDetails}` : ''}`;
            this.logger.error(errorMessage);
            reject(new TtsError(errorMessage));
          }
        },
        (error) => {
          synthesizer.close();
          this.logger.error(`Azure TTS error callback: ${error}`);
          reject(new TtsError(`Azure TTS synthesis error: ${error}`));
        },
      );
    });
  }
}
