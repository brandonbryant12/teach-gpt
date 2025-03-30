import { Module, DynamicModule, Provider, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TtsService } from './tts.service';
import {
  ITtsProvider,
  TTS_PROVIDER_SERVICE,
} from './interfaces/itts-provider.interface';
import { OpenAiTtsProvider } from './providers/openai-tts.provider';
// Import other providers here when they are created
// import { GoogleCloudTtsProvider } from './providers/google-cloud-tts.provider';
// --- Import Azure Provider ---
import { AzureTtsProvider } from './providers/azure-tts.provider';
// --- Import Google Provider ---
import { GoogleCloudTtsProvider } from './providers/google-cloud-tts.provider';

@Module({})
export class TtsModule {
  private static readonly logger = new Logger(TtsModule.name);

  static forRoot(): DynamicModule {
    const ttsProviderFactory: Provider = {
      provide: TTS_PROVIDER_SERVICE,
      useFactory: (
        configService: ConfigService,
        openAiProvider: OpenAiTtsProvider,
        // --- Inject Azure Provider ---
        azureProvider: AzureTtsProvider,
        // --- Inject Google Provider ---
        googleProvider: GoogleCloudTtsProvider,
      ): ITtsProvider => {
        const providerName = (
          configService.get<string>('TTS_PROVIDER') || 'openai'
        ).toLowerCase();

        this.logger.log(
          `Selected TTS Provider based on config: ${providerName}`,
        );

        switch (providerName) {
          case 'openai':
            return openAiProvider;
          // case 'google-cloud-tts':
          //   return googleProvider;
          // --- Add Azure Case ---
          case 'azure': // Or use 'microsoft-cognitiveservices-speech-sdk' or similar if preferred
            return azureProvider;
          // --- Add Google Case ---
          case 'google': // Or use 'google-cloud-tts' if preferred
            return googleProvider;
          default:
            this.logger.warn(
              `Unsupported TTS_PROVIDER specified: '${providerName}'. Defaulting to 'openai'.`,
            );
            // Optionally throw an error if default is not desired:
            // throw new Error(`Unsupported TTS_PROVIDER: ${providerName}`);
            return openAiProvider; // Default to OpenAI
        }
      },
      inject: [
        ConfigService,
        OpenAiTtsProvider,
        // --- Add Azure Provider to Injection List ---
        AzureTtsProvider,
        // --- Add Google Provider to Injection List ---
        GoogleCloudTtsProvider,
      ],
    };

    return {
      module: TtsModule,
      imports: [
        ConfigModule, // Ensure ConfigModule is imported to access ConfigService
      ],
      providers: [
        TtsService,
        // Register all possible provider implementations so they can be injected
        // into the factory. NestJS handles instantiation.
        OpenAiTtsProvider,
        // GoogleCloudTtsProvider,
        // --- Register Azure Provider ---
        AzureTtsProvider, // Add Azure provider here
        // --- Register Google Provider ---
        GoogleCloudTtsProvider, // Add Google provider here
        ttsProviderFactory, // The factory provider itself
      ],
      exports: [
        TtsService, // Export TtsService for use in other modules
      ],
    };
  }
}
