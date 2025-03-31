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
      useFactory: (configService: ConfigService): ITtsProvider => {
        const providerName = (
          configService.get<string>('TTS_PROVIDER') || 'openai'
        ).toLowerCase();

        this.logger.log(
          `Selected TTS Provider based on config: ${providerName}`,
        );

        switch (providerName) {
          case 'openai':
            this.logger.log('Using OpenAI TTS provider.');
            return new OpenAiTtsProvider(configService);
          case 'azure':
            this.logger.log('Using Azure TTS provider.');
            return new AzureTtsProvider(configService);
          case 'google':
            this.logger.log('Using Google Cloud TTS provider.');
            return new GoogleCloudTtsProvider();
          default:
            this.logger.warn(
              `Unsupported TTS_PROVIDER specified: '${providerName}'. Defaulting to 'openai'.`,
            );
            return new OpenAiTtsProvider(configService);
        }
      },
      inject: [ConfigService],
    };

    return {
      module: TtsModule,
      imports: [ConfigModule],
      providers: [TtsService, ttsProviderFactory],
      exports: [TtsService],
    };
  }
}
