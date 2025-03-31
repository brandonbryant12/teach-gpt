import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import * as cheerio from 'cheerio';
import { ScrapeResult } from './scraper.types';
import { ScraperError } from './scraper.error';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly FETCH_TIMEOUT_MS = 15000;

  constructor(private readonly httpService: HttpService) {}

  async scrapeUrl(url: string): Promise<ScrapeResult> {
    this.logger.log(`Attempting to scrape URL: ${url}`);

    try {
      new URL(url);
    } catch (error) {
      this.logger.error(`Invalid URL format: ${url}`, error.stack);
      throw new ScraperError(
        `Invalid URL format: ${url}`,
        'INVALID_URL',
        error,
      );
    }

    let htmlContent: string;
    try {
      const response = await firstValueFrom(
        this.httpService
          .get<string>(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            responseType: 'text',
          })
          .pipe(
            timeout(this.FETCH_TIMEOUT_MS),
            catchError((error: AxiosError) => {
              if (
                error.code === 'ECONNABORTED' ||
                error.message.includes('timeout')
              ) {
                this.logger.error(`Timeout fetching URL: ${url}`, error.stack);
                throw new ScraperError(
                  `Timeout fetching URL: ${url}`,
                  'TIMEOUT',
                  error,
                );
              }

              this.logger.error(
                `Failed to fetch URL: ${url} - Status: ${error.response?.status}`,
                error.stack,
              );
              throw new ScraperError(
                `Failed to fetch URL: ${url}. Status: ${error.response?.status || 'N/A'}`,
                'FETCH_FAILED',
                error,
                error.response?.status,
              );
            }),
          ),
      );
      htmlContent = response.data;
      this.logger.log(`Successfully fetched HTML from ${url}`);
    } catch (error) {
      if (error instanceof ScraperError) {
        throw error;
      }
      this.logger.error(`Unexpected error fetching URL: ${url}`, error.stack);
      throw new ScraperError(
        `An unexpected error occurred while fetching ${url}`,
        'FETCH_FAILED',
        error,
      );
    }

    let article: ReturnType<Readability['parse']>;
    try {
      const dom = new JSDOM(htmlContent, { url });

      const reader = new Readability(dom.window.document);
      article = reader.parse();

      if (!article || !article.content || !article.title) {
        this.logger.warn(
          `Readability could not find significant content or title in ${url}`,
        );
        throw new ScraperError(
          `Could not extract meaningful content or title from ${url}.`,
          'NO_CONTENT',
        );
      }
      this.logger.log(`Successfully parsed content for: ${article.title}`);
    } catch (error) {
      if (error instanceof ScraperError) {
        throw error;
      }
      this.logger.error(
        `Failed to parse HTML content from ${url} with Readability`,
        (error as Error).stack,
      );
      throw new ScraperError(
        `Failed to parse HTML content from ${url}.`,
        'PARSE_FAILED',
        error instanceof Error ? error : undefined,
      );
    }

    let bodyText: string;
    try {
      const $ = cheerio.load(article.content);

      $('script, style').remove();

      const paragraphs: string[] = [];
      $('p').each((_, element) => {
        const paragraphText = $(element).text().trim();
        if (paragraphText) {
          paragraphs.push(paragraphText);
        }
      });

      if (paragraphs.length === 0) {
        this.logger.warn(
          `No <p> tags found in Readability output for ${url}. Falling back to full text extraction.`,
        );
        let fullText = $('body').text();
        fullText = fullText.replace(/\s{2,}/g, ' ').trim();
        fullText = fullText.replace(/(\r\n|\n|\r)/gm, '\n\n');
        bodyText = fullText;
      } else {
        bodyText = paragraphs.join('\n\n');
      }

      if (!bodyText.trim()) {
        this.logger.warn(
          `Extracted body text is empty after cleaning for ${url}`,
        );
        throw new ScraperError(
          `Extracted content is empty after cleaning for ${url}.`,
          'NO_CONTENT',
        );
      }
    } catch (error) {
      if (error instanceof ScraperError) {
        throw error;
      }
      this.logger.error(
        `Error cleaning extracted text from ${url}`,
        (error as Error).stack,
      );
      throw new ScraperError(
        `Failed to clean extracted text content from ${url}.`,
        'OTHER',
        error instanceof Error ? error : undefined,
      );
    }

    const result: ScrapeResult = {
      title: article.title.trim(),
      bodyText: bodyText,
    };

    this.logger.log(
      `Scraping successful for ${url}. Title: ${result.title.substring(0, 50)}...`,
    );
    return result;
  }
}
