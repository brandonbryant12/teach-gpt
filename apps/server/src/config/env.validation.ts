/* eslint-disable @typescript-eslint/no-unsafe-call */
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  validateSync,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Provision = 'provision',
}

enum LlmProvider {
  OpenAI = 'openai',
  Stub = 'stub',
  GoogleAI = 'google-ai',
  // Add other providers here
  // AzureOpenAI = 'azure-openai',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  // LLM Configuration
  @IsEnum(LlmProvider)
  @IsOptional()
  LLM_PROVIDER: LlmProvider = LlmProvider.OpenAI;

  // OpenAI Configuration (Optional based on LLM_PROVIDER)
  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  @IsString()
  @IsOptional()
  OPENAI_DEFAULT_MODEL?: string = 'gpt-4o';

  // Google AI Configuration (Optional based on LLM_PROVIDER)
  @IsString()
  @IsOptional()
  GOOGLE_API_KEY?: string;

  @IsString()
  @IsOptional()
  GOOGLE_DEFAULT_MODEL?: string = 'gemini-1.5-flash';

  // Add validation for other provider keys if needed
  // @IsString()
  // @IsOptional()
  // GOOGLE_API_KEY?: string;

  // --- Add JWT Validation ---
  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRATION_TIME: string;
  // --- End JWT Validation ---

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  FFMPEG_PATH: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  // --- Combine error checks ---
  const conditionalErrors: string[] = [];

  if (
    validatedConfig.LLM_PROVIDER === LlmProvider.OpenAI &&
    !validatedConfig.OPENAI_API_KEY
  ) {
    conditionalErrors.push(
      'OPENAI_API_KEY is required when LLM_PROVIDER is set to "openai"',
    );
  }
  if (
    validatedConfig.LLM_PROVIDER === LlmProvider.GoogleAI &&
    !validatedConfig.GOOGLE_API_KEY
  ) {
    conditionalErrors.push(
      'GOOGLE_API_KEY is required when LLM_PROVIDER is set to "google-ai"',
    );
  }
  // Add similar checks for other providers...

  if (errors.length > 0 || conditionalErrors.length > 0) {
    const validationErrorMessages = errors
      .map((error) => Object.values(error.constraints || {}))
      .flat();

    const allErrors = [...validationErrorMessages, ...conditionalErrors];

    throw new Error(
      `Environment variable validation failed:\n- ${allErrors.join('\n- ')}`,
    );
  }

  // Extra validation: ensure API key exists if provider is selected
  if (
    validatedConfig.LLM_PROVIDER === LlmProvider.OpenAI &&
    !validatedConfig.OPENAI_API_KEY
  ) {
    console.warn(
      'WARN: LLM_PROVIDER is "openai" but OPENAI_API_KEY is not set. OpenAI calls will fail.',
    );
    // Optionally throw: throw new Error('OPENAI_API_KEY must be provided when LLM_PROVIDER is openai');
  }
  if (
    validatedConfig.LLM_PROVIDER === LlmProvider.GoogleAI &&
    !validatedConfig.GOOGLE_API_KEY
  ) {
    console.warn(
      'WARN: LLM_PROVIDER is "google-ai" but GOOGLE_API_KEY is not set. Google AI calls will fail.',
    );
    // Optionally throw: throw new Error('GOOGLE_API_KEY must be provided when LLM_PROVIDER is google-ai');
  }
  // Add similar checks for other providers

  return validatedConfig;
}
