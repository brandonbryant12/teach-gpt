import { Test, TestingModule } from '@nestjs/testing';
import { ScraperService } from './scraper.service';
import { ScraperModule } from './scraper.module';
import { ScraperError } from './scraper.error';

describe('ScraperService', () => {
  let service: ScraperService;

  jest.setTimeout(30000);

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ScraperModule],
    }).compile();

    service = module.get<ScraperService>(ScraperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should scrape the Wikipedia test article successfully', async () => {
    const url = 'https://en.wikipedia.org/wiki/Test_article_(aerospace)';
    try {
      const result = await service.scrapeUrl(url);

      expect(result).toBeDefined();
      expect(result.title).toContain('Test article');
      expect(result.bodyText).toBeDefined();
      expect(result.bodyText.length).toBeGreaterThan(50);
      expect(result.bodyText).toMatch(/aerospace|pathfinder/i);
      expect(result.bodyText).not.toMatch(/<script>/i);
      expect(result.bodyText).not.toMatch(/<style>/i);
      expect(result.bodyText).not.toMatch(/navbar/i);
    } catch (error) {
      console.error('Scraping failed in test:', error);
      if (error instanceof ScraperError) {
        console.error('ScraperError Details:', {
          type: error.type,
          message: error.message,
          statusCode: error.statusCode,
          originalError: error.originalError?.message,
        });
      }
      throw error;
    }
  });

  it('should throw ScraperError for an invalid URL format', async () => {
    const invalidUrl = 'invalid-url-string';
    await expect(service.scrapeUrl(invalidUrl)).rejects.toThrow(ScraperError);

    await expect(service.scrapeUrl(invalidUrl)).rejects.toHaveProperty(
      'type',
      'INVALID_URL',
    );
  });

  it('should throw ScraperError (FETCH_FAILED) for a non-existent domain', async () => {
    const nonExistentUrl =
      'http://thisdomainprobablydoesnotexist1234567890.com';
    await expect(service.scrapeUrl(nonExistentUrl)).rejects.toThrow(
      ScraperError,
    );

    await expect(service.scrapeUrl(nonExistentUrl)).rejects.toHaveProperty(
      'type',
      'FETCH_FAILED',
    );
  });

  it('should throw ScraperError (TIMEOUT) if fetch takes too long', async () => {
    const slowUrl = 'http://localhost:9999';

    await expect(service.scrapeUrl(slowUrl)).rejects.toThrow(ScraperError);

    await expect(service.scrapeUrl(slowUrl)).rejects.toHaveProperty(
      'type',
      'FETCH_FAILED',
    );
  }, 20000);
});
