import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TtsService } from './tts.service';
import {
  ITtsProvider,
  TTS_PROVIDER_SERVICE,
} from './interfaces/itts-provider.interface';
import { TtsError } from './errors/tts.error';
import { TtsGenerationOptions } from './dto/tts-generation-options.dto';

// Mock the ITtsProvider
const mockTtsProvider: jest.Mocked<ITtsProvider> = {
  generateSpeech: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

describe('TtsService', () => {
  let service: TtsService;
  let configService: ConfigService;
  let ttsProvider: ITtsProvider;

  beforeEach(async () => {
    // Reset mocks
    mockTtsProvider.generateSpeech.mockReset();
    mockConfigService.get.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TtsService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TTS_PROVIDER_SERVICE, useValue: mockTtsProvider },
        // We don't need to provide the concrete implementations (OpenAI, Azure)
        // for the service unit test, as we inject the mock provider directly.
      ],
    }).compile();

    // Mock ConfigService behavior *before* getting the TtsService instance
    // Default to OpenAI provider for most tests unless specified otherwise
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'TTS_PROVIDER') return 'openai';
      return undefined;
    });

    service = module.get<TtsService>(TtsService);
    configService = module.get<ConfigService>(ConfigService);
    ttsProvider = module.get<ITtsProvider>(TTS_PROVIDER_SERVICE);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with "openai" provider if TTS_PROVIDER is unset', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'TTS_PROVIDER') return undefined; // Simulate unset env var
      return undefined;
    });
    // Need to re-instantiate the service
    const testModule: TestingModule = await Test.createTestingModule({
      providers: [
        TtsService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TTS_PROVIDER_SERVICE, useValue: mockTtsProvider },
      ],
    }).compile();

    const testService = testModule.get<TtsService>(TtsService);
    expect((testService as any).activeProviderName).toBe('openai');
  });

  it('should initialize with the provider specified by TTS_PROVIDER (case-insensitive)', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'TTS_PROVIDER') return 'aZuRe'; // Test case-insensitivity
      return undefined;
    });
    const testModule: TestingModule = await Test.createTestingModule({
      providers: [
        TtsService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TTS_PROVIDER_SERVICE, useValue: mockTtsProvider },
      ],
    }).compile();
    const testService = testModule.get<TtsService>(TtsService);
    expect((testService as any).activeProviderName).toBe('azure');
  });

  describe('generateSpeech (with OpenAI provider active)', () => {
    const testText = 'Test speech generation.';
    const mockBuffer = Buffer.from('openai-audio-data');

    beforeEach(async () => {
      // Ensure OpenAI is the active provider for these tests
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'TTS_PROVIDER') return 'openai';
        return undefined;
      });
      // Re-get the service instance to reflect the config change
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TtsService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TTS_PROVIDER_SERVICE, useValue: mockTtsProvider },
        ],
      }).compile();
      service = module.get<TtsService>(TtsService);

      mockTtsProvider.generateSpeech.mockResolvedValue(mockBuffer); // Mock successful generation
    });

    it('should map "Ash" to "onyx" and call provider.generateSpeech', async () => {
      const options: TtsGenerationOptions = { voice: 'Ash', speed: 1.1 };
      const result = await service.generateSpeech(testText, options);

      expect(mockTtsProvider.generateSpeech).toHaveBeenCalledWith(testText, {
        providerVoiceId: 'onyx',
        languageCode: undefined, // Not provided in options
        speed: 1.1,
        audioFormat: 'mp3',
      });
      expect(result).toBe(mockBuffer);
    });

    it('should map "Jenny" to "nova" and call provider.generateSpeech', async () => {
      const options: TtsGenerationOptions = {
        voice: 'Jenny',
        languageCode: 'en-GB',
      };
      const result = await service.generateSpeech(testText, options);

      expect(mockTtsProvider.generateSpeech).toHaveBeenCalledWith(testText, {
        providerVoiceId: 'nova',
        languageCode: 'en-GB',
        speed: undefined, // Not provided
        audioFormat: 'mp3',
      });
      expect(result).toBe(mockBuffer);
    });

    it('should throw TtsError if provider.generateSpeech throws an error', async () => {
      const providerError = new TtsError('Provider failed');
      mockTtsProvider.generateSpeech.mockRejectedValue(providerError);

      const options: TtsGenerationOptions = { voice: 'Ash' };

      await expect(service.generateSpeech(testText, options)).rejects.toThrow(
        TtsError,
      );
      await expect(service.generateSpeech(testText, options)).rejects.toThrow(
        /TTS provider \(openai\) failed during speech generation: Provider failed/,
      );
      // Check if the original error is preserved if it was already a TtsError
      try {
        await service.generateSpeech(testText, options);
      } catch (e) {
        expect(e).toBe(providerError); // Should re-throw the same TtsError instance
      }
    });

    it('should wrap and throw TtsError if provider.generateSpeech throws a generic error', async () => {
      const genericError = new Error('Generic provider failure');
      mockTtsProvider.generateSpeech.mockRejectedValue(genericError);

      const options: TtsGenerationOptions = { voice: 'Ash' };

      await expect(service.generateSpeech(testText, options)).rejects.toThrow(
        TtsError,
      );
      await expect(service.generateSpeech(testText, options)).rejects.toThrow(
        /TTS provider \(openai\) failed during speech generation: Generic provider failure/,
      );
      // Check if the original error is attached as cause
      try {
        await service.generateSpeech(testText, options);
      } catch (e) {
        expect(e.cause).toBe(genericError);
      }
    });

    it('should throw TtsError for invalid application voice (caught by mapping)', async () => {
      // This test relies on the internal mapping function throwing an error.
      const options: TtsGenerationOptions = { voice: 'InvalidVoice' as any }; // Cast to bypass TS check

      await expect(service.generateSpeech(testText, options)).rejects.toThrow(
        TtsError,
      );
      await expect(service.generateSpeech(testText, options)).rejects.toThrow(
        /Invalid OpenAI voice name specified: InvalidVoice/,
      );
      expect(mockTtsProvider.generateSpeech).not.toHaveBeenCalled();
    });
  });

  // Add a similar describe block for 'generateSpeech (with Azure provider active)'
  // to test Azure voice mapping ('Ash' -> 'en-US-DavisNeural', etc.)
  describe('generateSpeech (with Azure provider active)', () => {
    const testText = 'Test Azure speech.';
    const mockBuffer = Buffer.from('azure-audio-data');

    beforeEach(async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'TTS_PROVIDER') return 'azure';
        return undefined;
      });
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TtsService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TTS_PROVIDER_SERVICE, useValue: mockTtsProvider },
        ],
      }).compile();
      service = module.get<TtsService>(TtsService);
      mockTtsProvider.generateSpeech.mockResolvedValue(mockBuffer);
    });

    it('should map "Ash" to "en-US-DavisNeural" and call provider.generateSpeech', async () => {
      const options: TtsGenerationOptions = { voice: 'Ash' };
      await service.generateSpeech(testText, options);
      expect(mockTtsProvider.generateSpeech).toHaveBeenCalledWith(testText, {
        providerVoiceId: 'en-US-DavisNeural',
        languageCode: undefined,
        speed: undefined,
        audioFormat: 'mp3',
      });
    });

    it('should map "Jenny" to "en-US-JennyNeural" and call provider.generateSpeech', async () => {
      const options: TtsGenerationOptions = { voice: 'Jenny' };
      await service.generateSpeech(testText, options);
      expect(mockTtsProvider.generateSpeech).toHaveBeenCalledWith(testText, {
        providerVoiceId: 'en-US-JennyNeural',
        languageCode: undefined,
        speed: undefined,
        audioFormat: 'mp3',
      });
    });

    it('should throw TtsError for invalid application voice (caught by mapping)', async () => {
      const options: TtsGenerationOptions = { voice: 'InvalidVoice' as any };
      await expect(service.generateSpeech(testText, options)).rejects.toThrow(
        TtsError,
      );
      await expect(service.generateSpeech(testText, options)).rejects.toThrow(
        /Unsupported application voice for Azure TTS: InvalidVoice/,
      );
      expect(mockTtsProvider.generateSpeech).not.toHaveBeenCalled();
    });
  });

  describe('generateSpeech (with unsupported provider active)', () => {
    beforeEach(async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'TTS_PROVIDER') return 'unsupported-provider';
        return undefined;
      });
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TtsService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TTS_PROVIDER_SERVICE, useValue: mockTtsProvider },
        ],
      }).compile();
      service = module.get<TtsService>(TtsService);
    });

    it('should throw TtsError during voice mapping', async () => {
      const options: TtsGenerationOptions = { voice: 'Ash' };
      await expect(service.generateSpeech('test', options)).rejects.toThrow(
        TtsError,
      );
      await expect(service.generateSpeech('test', options)).rejects.toThrow(
        /Voice mapping not implemented for provider: unsupported-provider/,
      );
      expect(mockTtsProvider.generateSpeech).not.toHaveBeenCalled();
    });
  });
});
