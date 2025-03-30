import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import * as cheerio from 'cheerio'; // Import cheerio
import { ScrapeResult } from './scraper.types';
import { ScraperError } from './scraper.error';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  // Define a reasonable timeout (e.g., 15 seconds)
  private readonly FETCH_TIMEOUT_MS = 15000;

  constructor(private readonly httpService: HttpService) {}

  /**
   * Fetches a URL, extracts the main content and title.
   * @param url The HTTP/HTTPS URL to scrape.
   * @returns A Promise resolving to a ScrapeResult object.
   * @throws {ScraperError} If fetching, parsing, or content extraction fails.
   */
  async scrapeUrl(url: string): Promise<ScrapeResult> {
    this.logger.log(`Attempting to scrape URL: ${url}`);

    // 1. Validate URL format (basic check)
    try {
      new URL(url); // Throws TypeError if invalid
    } catch (error) {
      this.logger.error(`Invalid URL format: ${url}`, error.stack);
      throw new ScraperError(
        `Invalid URL format: ${url}`,
        'INVALID_URL',
        error,
      );
    }

    // 2. Fetch HTML Content
    let htmlContent: string;
    try {
      const response = await firstValueFrom(
        this.httpService
          .get<string>(url, {
            // Set headers to mimic a browser to avoid simple blocks
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            // Ensure response is treated as text
            responseType: 'text',
          })
          .pipe(
            timeout(this.FETCH_TIMEOUT_MS), // Apply timeout
            catchError((error: AxiosError) => {
              // Handle timeout specifically
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
      // Catch errors specifically thrown from the catchError block or other unexpected issues
      if (error instanceof ScraperError) {
        throw error; // Re-throw ScraperErrors
      }
      // Handle unexpected errors during fetching
      this.logger.error(`Unexpected error fetching URL: ${url}`, error.stack);
      throw new ScraperError(
        `An unexpected error occurred while fetching ${url}`,
        'FETCH_FAILED',
        error,
      );
    }

    // 3. Parse HTML and Extract Content with Readability
    let article: ReturnType<Readability['parse']>;
    try {
      // Use JSDOM to create a DOM environment for Readability
      // Provide the URL as the base URI for resolving relative links if needed by Readability
      const dom = new JSDOM(htmlContent, { url });

      // Use Readability to find the main content
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
        throw error; // Re-throw NO_CONTENT error
      }
      this.logger.error(
        `Failed to parse HTML content from ${url} with Readability`,
        error.stack,
      );
      throw new ScraperError(
        `Failed to parse HTML content from ${url}.`,
        'PARSE_FAILED',
        error,
      );
    }

    // 4. Clean Extracted Text
    let bodyText: string;
    try {
      // Load the HTML content extracted by Readability into cheerio
      const $ = cheerio.load(article.content);

      // Remove script and style tags potentially left by Readability (though unlikely)
      $('script, style').remove();

      // Extract text from paragraphs, preserving structure
      const paragraphs: string[] = [];
      $('p').each((_, element) => {
        const paragraphText = $(element).text().trim();
        if (paragraphText) {
          // Only add non-empty paragraphs
          paragraphs.push(paragraphText);
        }
      });

      // If no <p> tags found, try getting all text and basic normalization
      if (paragraphs.length === 0) {
        this.logger.warn(
          `No <p> tags found in Readability output for ${url}. Falling back to full text extraction.`,
        );
        let fullText = $('body').text();
        // Basic normalization: replace multiple newlines/spaces with single ones/double newlines
        fullText = fullText.replace(/\s{2,}/g, ' ').trim(); // Condense whitespace
        fullText = fullText.replace(/(\r\n|\n|\r)/gm, '\n\n'); // Standardize newlines for paragraphs (heuristic)
        bodyText = fullText;
      } else {
        bodyText = paragraphs.join('\n\n');
      }

      // Final check for emptiness after cleaning
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
        throw error; // Re-throw NO_CONTENT error
      }
      this.logger.error(
        `Error cleaning extracted text from ${url}`,
        error.stack,
      );
      // Use 'OTHER' as this is an unexpected cleaning error
      throw new ScraperError(
        `Failed to clean extracted text content from ${url}.`,
        'OTHER',
        error,
      );
    }

    // 5. Return Result
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
