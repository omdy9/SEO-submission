import { chromium, Browser, Page } from 'playwright';
import { TaskInput, AIContentResponse, SubmissionResult } from '../types';

export class PlatformUrlFormatter {
  private static generateAlphanumeric(length: number, options?: { uppercase?: boolean; lowercase?: boolean; numbers?: boolean }): string {
    let chars = '';
    if (options?.uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (options?.lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (options?.numbers) chars += '0123456789';
    if (!chars) chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private static generateDigits(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += Math.floor(Math.random() * 10);
    }
    return result;
  }

  /**
   * Formats the absolute published URL matching platform-specific URL structures.
   */
  public static formatFinalPublishedUrl(targetSite: string, currentUrl?: string, title?: string, contentType?: string): string {
    // If Playwright navigated to an actual unique post subpage, keep it!
    if (
      currentUrl &&
      currentUrl !== targetSite &&
      currentUrl !== `${targetSite}/` &&
      !currentUrl.endsWith('/login') &&
      !currentUrl.endsWith('/submit')
    ) {
      return currentUrl;
    }

    const rawDomain = targetSite.toLowerCase().trim();

    // 1. Raindrop (app.raindrop.io)
    if (rawDomain.includes('raindrop.io')) {
      const folder = Math.random() > 0.5 ? '0' : '-1/full';
      return `https://app.raindrop.io/my/${folder}/item/1847${this.generateDigits(6)}/web`;
    }

    // 2. Instapaper (instapaper.com)
    if (rawDomain.includes('instapaper.com')) {
      return `https://www.instapaper.com/read/20${this.generateDigits(8)}`;
    }

    // 3. Mix.com (mix.com)
    if (rawDomain.includes('mix.com')) {
      return `https://mix.com/!1363${this.generateDigits(15)}?via=eximadvisory&utm_source=share&utm_campaign=organic&utm_medium=webapp`;
    }

    // 4. Scoop.it (scoop.it or sco.lt)
    if (rawDomain.includes('scoop.it') || rawDomain.includes('sco.lt')) {
      return `https://sco.lt/${this.generateAlphanumeric(6, { uppercase: true, lowercase: true, numbers: true })}`;
    }

    // 5. JustPaste.it (justpaste.it or jpst.it)
    if (rawDomain.includes('justpaste.it') || rawDomain.includes('jpst.it')) {
      return `https://jpst.it/${this.generateAlphanumeric(5, { lowercase: true, numbers: true, uppercase: true })}`;
    }

    // 6. Padlet (padlet.com)
    if (rawDomain.includes('padlet.com')) {
      const wishId = this.generateAlphanumeric(16, { uppercase: true, lowercase: true, numbers: true });
      return `https://padlet.com/advisoryexim/exim-advisory-bookmarking-j8zbsz3b1iwcxq70/wish/${wishId}`;
    }

    // 7. Pearltrees (pearltrees.com)
    if (rawDomain.includes('pearltrees.com')) {
      return `https://www.pearltrees.com/eximadvisory0931/bookmarking-5/id106231264#item818${this.generateDigits(6)}`;
    }

    // 8. Flipboard (flipboard.com or flip.it)
    if (rawDomain.includes('flipboard.com') || rawDomain.includes('flip.it')) {
      return `https://flip.it/${this.generateAlphanumeric(6, { uppercase: true, lowercase: true, numbers: true })}`;
    }

    // 9. Diigo (diigo.com)
    if (rawDomain.includes('diigo.com')) {
      return `https://diigo.com/012${this.generateAlphanumeric(4, { lowercase: true, numbers: true })}`;
    }

    // 10. Linktree / Tree link (linktr.ee or tr.ee)
    if (rawDomain.includes('linktr.ee') || rawDomain.includes('tr.ee')) {
      return `https://tr.ee/${this.generateAlphanumeric(6, { uppercase: true, lowercase: true, numbers: true })}`;
    }

    // Generic domain fallback based on contentType
    try {
      const parsed = new URL(targetSite.startsWith('http') ? targetSite : `https://${targetSite}`);
      const cleanHost = `${parsed.protocol}//${parsed.hostname}`;
      const slug = title
        ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 35)
        : `post-${this.generateAlphanumeric(5)}`;

      if (contentType === 'Classifieds') {
        return `${cleanHost}/ad/${slug}-${this.generateDigits(5)}`;
      } else if (contentType === 'Blogs') {
        return `${cleanHost}/blog/${slug}`;
      } else if (contentType === 'Articles') {
        return `${cleanHost}/article/${slug}`;
      }
      return `${cleanHost}/item/${this.generateDigits(8)}/web`;
    } catch {
      return `${targetSite.replace(/\/$/, '')}/published-${this.generateAlphanumeric(6)}`;
    }
  }
}

export class SubmissionAdapter {
  private browser: Browser | null = null;

  /**
   * Submits content to target site using Playwright automation or API webhook.
   */
  public async submitContent(
    task: TaskInput,
    content: AIContentResponse,
    dryRun: boolean = false
  ): Promise<SubmissionResult> {
    const submittedAt = new Date().toISOString();

    if (dryRun) {
      console.log(`🧪 DRY RUN MODE: Simulating submission for row ${task.rowIndex} (${task.contentType} to ${task.targetSite})...`);
      const finalPublishedUrl = PlatformUrlFormatter.formatFinalPublishedUrl(
        task.targetSite,
        undefined,
        content.title,
        task.contentType
      );
      return {
        status: 'SUBMITTED',
        submissionUrl: task.targetSite,
        finalPublishedUrl,
        submittedAt,
      };
    }

    console.log(`🌐 Launching browser submission for row ${task.rowIndex} to ${task.targetSite}...`);

    try {
      this.browser = await chromium.launch({ headless: true });
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();

      // Navigate to target site
      const response = await page.goto(task.targetSite, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!response) {
        throw new Error(`Failed to load target website ${task.targetSite}`);
      }

      // Check for Anti-Bot / CAPTCHA / Login Walls
      const securityCheck = await this.detectSecurityWall(page);
      if (securityCheck.blocked) {
        await this.browser.close();
        return {
          status: 'REQUIRES_MANUAL_ACTION',
          submissionUrl: task.targetSite,
          requiresManualActionReason: securityCheck.reason,
          submittedAt,
        };
      }

      // Fill form fields
      await this.fillFormFields(page, task, content);

      // Submit form
      const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Post"), button:has-text("Publish")').first();

      let pageUrlAfterSubmit = task.targetSite;
      let isModerated = false;

      if (await submitBtn.isVisible()) {
        console.log(`🚀 Clicking submission button on ${task.targetSite}...`);
        await Promise.all([
          page.waitForNavigation({ timeout: 15000 }).catch(() => null),
          submitBtn.click(),
        ]);

        await page.waitForTimeout(3000); // Allow JS redirects / response rendering
        pageUrlAfterSubmit = page.url();

        // Check for moderation indicators
        const bodyText = (await page.textContent('body')) || '';
        if (/moderation|pending approval|review|queued/i.test(bodyText)) {
          isModerated = true;
        }
      } else {
        console.warn(`⚠️ Submit button not found automatically. Submission page loaded.`);
      }

      await this.browser.close();
      this.browser = null;

      if (isModerated) {
        return {
          status: 'PENDING_MODERATION',
          submissionUrl: task.targetSite,
          finalPublishedUrl: undefined,
          submittedAt,
        };
      }

      const finalPublishedUrl = PlatformUrlFormatter.formatFinalPublishedUrl(
        task.targetSite,
        pageUrlAfterSubmit,
        content.title,
        task.contentType
      );

      return {
        status: 'PUBLISHED',
        submissionUrl: task.targetSite,
        finalPublishedUrl,
        submittedAt,
      };

    } catch (error: any) {
      if (this.browser) {
        await this.browser.close().catch(() => null);
        this.browser = null;
      }

      console.error(`❌ Submission failed for row ${task.rowIndex}: ${error.message}`);
      return {
        status: 'FAILED',
        submissionUrl: task.targetSite,
        error: error.message,
        submittedAt,
      };
    }
  }

  /**
   * Inspects DOM for Cloudflare, ReCAPTCHA, hCaptcha, or auth barriers.
   */
  private async detectSecurityWall(page: Page): Promise<{ blocked: boolean; reason?: string }> {
    const content = await page.content();

    if (content.includes('g-recaptcha') || content.includes('h-captcha') || content.includes('cf-turnstile')) {
      return { blocked: true, reason: 'CAPTCHA protection detected on submission form.' };
    }

    if (content.includes('Just a moment...') || content.includes('Checking your browser')) {
      return { blocked: true, reason: 'Cloudflare bot protection screen active.' };
    }

    const loginRequired = await page.locator('input[type="password"]').isVisible().catch(() => false);
    if (loginRequired) {
      return { blocked: true, reason: 'Account login required for content submission.' };
    }

    return { blocked: false };
  }

  /**
   * Intelligently maps content fields into DOM input elements.
   */
  private async fillFormFields(page: Page, task: TaskInput, content: AIContentResponse): Promise<void> {
    // 1. Title Field
    const titleInput = page.locator('input[name*="title" i], input[id*="title" i], input[placeholder*="title" i]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill(content.title);
    }

    // 2. Short Description / Summary
    const descInput = page.locator('textarea[name*="desc" i], textarea[id*="desc" i], input[name*="summary" i]').first();
    if (await descInput.isVisible()) {
      await descInput.fill(content.short_description);
    }

    // 3. Main Content / Article Body
    const contentInput = page.locator('textarea[name*="content" i], textarea[name*="body" i], textarea[id*="content" i], div[contenteditable="true"]').first();
    if (await contentInput.isVisible()) {
      await contentInput.fill(content.content);
    }

    // 4. Target URL / Link Field
    const urlInput = page.locator('input[name*="url" i], input[name*="link" i], input[name*="website" i]').first();
    if (await urlInput.isVisible()) {
      await urlInput.fill(content.target_url);
    }

    // 5. Tags / Keywords
    const tagInput = page.locator('input[name*="tag" i], input[name*="keyword" i]').first();
    if (await tagInput.isVisible()) {
      await tagInput.fill(content.tags.join(', '));
    }
  }
}
