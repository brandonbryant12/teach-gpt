export interface ScrapeResult {
  title: string; // The extracted page/article title
  bodyText: string; // The cleaned, main textual content with paragraphs separated by \n\n
}
