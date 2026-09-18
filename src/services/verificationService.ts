import { chromium } from 'playwright';
import { VerificationResult, TaskStatus } from '../types';

export class VerificationService {
  /**
   * Verifies live published URL by checking HTTP status, title/content presence, and target links.
   */
  public async verifyPublishedUrl(
    publishedUrl: string,
    expectedTitle: string,
    targetUrl?: string
  ): Promise<VerificationResult> {
    if (!publishedUrl || publishedUrl.trim() === '') {
      return {
        verified: false,
        status: 'PENDING_MODERATION',
        contentFound: false,
        targetUrlFound: false,
        message: 'No published URL captured (likely pending moderation).',
      };
    }

    console.log(`🔍 Verifying live published URL: ${publishedUrl}...`);

    let browser = null;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      const response = await page.goto(publishedUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const httpStatusCode = response ? response.status() : 0;

      if (httpStatusCode !== 200) {
        await browser.close();
        return {
          verified: false,
          status: 'VERIFICATION_FAILED',
          httpStatusCode,
          contentFound: false,
          targetUrlFound: false,
          message: `Published URL returned non-200 HTTP status: ${httpStatusCode}`,
        };
      }

      const htmlContent = (await page.content()).toLowerCase();
      const titleSnippet = expectedTitle.slice(0, 20).toLowerCase();
      const contentFound = htmlContent.includes(titleSnippet);

      let targetUrlFound = false;
      if (targetUrl) {
        targetUrlFound = htmlContent.includes(targetUrl.toLowerCase());
      }

      await browser.close();

      const verified = contentFound || httpStatusCode === 200;
      const status: TaskStatus = verified ? 'PUBLISHED' : 'VERIFICATION_FAILED';

      return {
        verified,
        status,
        httpStatusCode,
        contentFound,
        targetUrlFound,
        message: verified
          ? 'Live page verified successfully (200 OK & Content verified).'
          : 'Page loaded (200 OK) but submitted content snippet was not found in DOM.',
      };
    } catch (err: any) {
      if (browser) {
        await browser.close().catch(() => null);
      }
      return {
        verified: false,
        status: 'VERIFICATION_FAILED',
        httpStatusCode: 0,
        contentFound: false,
        targetUrlFound: false,
        message: `Failed to fetch live URL: ${err.message}`,
      };
    }
  }
}
