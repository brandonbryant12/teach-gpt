import {
  Module,
  Global,
  DynamicModule,
  Provider,
  Logger,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { LlmService } from './llm.service';
import { LLM_PROVIDER, ILlmProvider } from './llm.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { StubLlmProvider } from './providers/stub.provider';
import { GoogleAiProvider } from './providers/google-ai.provider';
import { InternalProvider } from './providers/internal.provider';
import { LlmError } from './llm.error';

@Global() // Make LlmService available globally
@Module({})
export class LlmModule {
  private static readonly logger = new Logger(LlmModule.name);

  static forRoot(): DynamicModule {
    const llmProviderFactory: Provider = {
      provide: LLM_PROVIDER,
      useFactory: (
        configService: ConfigService,
        openaiProvider: OpenAiProvider,
        stubProvider: StubLlmProvider,
        googleAiProvider: GoogleAiProvider,
        internalProvider: InternalProvider,
      ): ILlmProvider => {
        const providerType = configService.get<string>(
          'LLM_PROVIDER',
          'openai',
        ); // Default to openai
        this.logger.log(`Configuring LLM provider: ${providerType}`);

        switch (providerType.toLowerCase()) {
          case 'openai':
            // Ensure API key exists for OpenAI, otherwise throw a config error early
            if (!configService.get<string>('OPENAI_API_KEY')) {
              this.logger.error(
                'OpenAI provider selected, but OPENAI_API_KEY is not configured.',
              );
              throw new LlmError(
                "LLM_PROVIDER is set to 'openai' but OPENAI_API_KEY is missing in environment configuration.",
                'INVALID_CONFIG',
              );
            }
            this.logger.log('Using OpenAI provider.');
            return openaiProvider;
          case 'stub':
            this.logger.log('Using Stub LLM provider.');
            return stubProvider;
          case 'google-ai':
            if (!configService.get<string>('GOOGLE_API_KEY')) {
              this.logger.error(
                'Google AI provider selected, but GOOGLE_API_KEY is not configured.',
              );
              throw new LlmError(
                "LLM_PROVIDER is set to 'google-ai' but GOOGLE_API_KEY is missing in environment configuration.",
                'INVALID_CONFIG',
              );
            }
            this.logger.log('Using Google AI provider.');
            return googleAiProvider;
          case 'internal':
            if (!configService.get<string>('INTERNAL_TOKEN_URL')) {
              this.logger.error(
                'Internal provider selected, but INTERNAL_TOKEN_URL is not configured.',
              );
              throw new LlmError(
                "LLM_PROVIDER is set to 'internal' but INTERNAL_TOKEN_URL is missing in environment configuration.",
                'INVALID_CONFIG',
              );
            }
            if (!configService.get<string>('INTERNAL_LLM_URL')) {
              this.logger.error(
                'Internal provider selected, but INTERNAL_LLM_URL is not configured.',
              );
              throw new LlmError(
                "LLM_PROVIDER is set to 'internal' but INTERNAL_LLM_URL is missing in environment configuration.",
                'INVALID_CONFIG',
              );
            }
            this.logger.log('Using Internal LLM provider.');
            return internalProvider;
          default:
            this.logger.error(
              `Unsupported LLM_PROVIDER configured: ${providerType}`,
            );
            throw new LlmError(
              `Unsupported LLM_PROVIDER: ${providerType}. Check environment configuration.`,
              'PROVIDER_NOT_SUPPORTED',
            );
        }
      },
      inject: [
        ConfigService,
        OpenAiProvider,
        StubLlmProvider,
        GoogleAiProvider,
        InternalProvider,
      ],
    };

    return {
      module: LlmModule,
      imports: [ConfigModule, HttpModule, CacheModule.register()],
      providers: [
        LlmService,
        OpenAiProvider,
        StubLlmProvider,
        GoogleAiProvider,
        InternalProvider,
        llmProviderFactory,
      ],
      exports: [LlmService],
    };
  }
}
