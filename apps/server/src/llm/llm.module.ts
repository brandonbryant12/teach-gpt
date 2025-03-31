import { Module, DynamicModule, Provider, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { CacheModule, Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { LlmService } from './llm.service';
import { LLM_PROVIDER, ILlmProvider } from './llm.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { StubLlmProvider } from './providers/stub.provider';
import { GoogleAiProvider } from './providers/google-ai.provider';
import { InternalProvider } from './providers/internal.provider';
import { LlmError } from './llm.error';

@Module({})
export class LlmModule {
  private static readonly logger = new Logger(LlmModule.name);

  static forRoot(): DynamicModule {
    const llmProviderFactory: Provider = {
      provide: LLM_PROVIDER,
      useFactory: (
        configService: ConfigService,
        httpService: HttpService,
        cacheManager: Cache,
      ): ILlmProvider => {
        const providerType = configService.get<string>(
          'LLM_PROVIDER',
          'openai',
        );
        this.logger.log(`Configuring LLM provider: ${providerType}`);
        switch (providerType.toLowerCase()) {
          case 'openai':
            this.logger.log('Using OpenAI provider.');
            return new OpenAiProvider(configService);
          case 'stub':
            this.logger.log('Using Stub LLM provider.');
            return new StubLlmProvider();
          case 'google-ai':
            this.logger.log('Using Google AI provider.');
            return new GoogleAiProvider(configService);
          case 'internal':
            this.logger.log('Using Internal LLM provider.');
            return new InternalProvider(
              configService,
              httpService,
              cacheManager,
            );
          default:
            this.logger.error(
              `Unsupported LLM_PROVIDER configured: ${providerType}`,
            );
            throw new LlmError(
              `Unsupported LLM_PROVIDER: ${providerType}. Check environment configuration.`,
              'INVALID_CONFIG',
            );
        }
      },
      inject: [ConfigService, HttpService, CACHE_MANAGER],
    };

    return {
      module: LlmModule,
      imports: [ConfigModule, HttpModule, CacheModule.register()],
      providers: [LlmService, llmProviderFactory],
      exports: [LlmService],
    };
  }
}
