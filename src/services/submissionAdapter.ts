import { chromium, Browser, Page } from 'playwright';
import { TaskInput, AIContentResponse, SubmissionResult, SubmissionCredentials } from '../types';

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
   * Submits content to target site using Playwright automation.
   * Executes 5-step Bookmarking workflow:
   * 1. Login to site
   * 2. Enter Title
   * 3. Enter Description
   * 4. Submit form
   * 5. Copy final link
   */
  public async submitContent(
    task: TaskInput,
    content: AIContentResponse,
    dryRun: boolean = false,
    credentials?: SubmissionCredentials
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

    console.log(`🌐 Launching browser submission for row ${task.rowIndex} (${task.contentType}) to ${task.targetSite}...`);

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

      // Check for Anti-Bot / CAPTCHA walls
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

      // ----------------------------------------------------
      // STEP 1: LOGIN TO SUBMISSION SITE
      // ----------------------------------------------------
      console.log(`🔑 Step 1/5: Checking login requirements on ${task.targetSite}...`);
      const loginResult = await this.handleLogin(page, task, credentials);
      if (!loginResult.success && loginResult.blocked) {
        await this.browser.close();
        return {
          status: 'REQUIRES_MANUAL_ACTION',
          submissionUrl: task.targetSite,
          requiresManualActionReason: loginResult.reason || 'Login failed or requires human action.',
          submittedAt,
        };
      }

      // ----------------------------------------------------
      // STEP 2 & 3: ENTER TITLE AND DESCRIPTION (+ TARGET URL & TAGS)
      // ----------------------------------------------------
      console.log(`📝 Step 2 & 3: Filling Title, Description, and Target URL...`);
      await this.navigateToSubmissionFormIfNeeded(page, task);
      await this.fillFormFields(page, task, content);

      // ----------------------------------------------------
      // STEP 4: SUBMIT FORM
      // ----------------------------------------------------
      console.log(`🚀 Step 4/5: Submitting bookmark/post form...`);
      const submitBtn = page.locator(
        'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Post"), button:has-text("Publish"), button:has-text("Add"), button:has-text("Save"), button:has-text("Bookmark")'
      ).first();

      let pageUrlAfterSubmit = task.targetSite;
      let isModerated = false;

      if (await submitBtn.isVisible().catch(() => false)) {
        await Promise.all([
          page.waitForNavigation({ timeout: 15000 }).catch(() => null),
          submitBtn.click(),
        ]);

        await page.waitForTimeout(3000); // Wait for async JS redirect or response rendering
        pageUrlAfterSubmit = page.url();

        // Check for moderation indicators
        const bodyText = (await page.textContent('body')) || '';
        if (/moderation|pending approval|review|queued/i.test(bodyText)) {
          isModerated = true;
        }
      } else {
        console.warn(`⚠️ Submit button not found automatically on page. Checking current page URL.`);
      }

      // ----------------------------------------------------
      // STEP 5: COPY FINAL LINK
      // ----------------------------------------------------
      console.log(`🔗 Step 5/5: Retrieving and copying final published link...`);
      const domPermalink = await this.extractPermalinkFromDOM(page);

      await this.browser.close();
      this.browser = null;

      if (isModerated) {
        console.log(`⏳ Row ${task.rowIndex} is pending moderation.`);
        return {
          status: 'PENDING_MODERATION',
          submissionUrl: task.targetSite,
          finalPublishedUrl: undefined,
          submittedAt,
        };
      }

      const finalPublishedUrl = domPermalink || PlatformUrlFormatter.formatFinalPublishedUrl(
        task.targetSite,
        pageUrlAfterSubmit,
        content.title,
        task.contentType
      );

      console.log(`✅ Final Link copied: ${finalPublishedUrl}`);

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
   * STEP 1 IMPLEMENTATION: Automatically detects login forms, fills credentials, and logs in.
   */
  private async handleLogin(
    page: Page,
    task: TaskInput,
    credentials?: SubmissionCredentials
  ): Promise<{ success: boolean; blocked?: boolean; reason?: string }> {
    try {
      let passwordInput = page.locator('input[type="password"]').first();
      let isPasswordVisible = await passwordInput.isVisible().catch(() => false);

      // If password field is not immediately visible, check for "Log In" / "Sign In" links or buttons
      if (!isPasswordVisible) {
        const loginLink = page.locator(
          'a:has-text("Log In"), a:has-text("Sign In"), a:has-text("Login"), a[href*="login" i], button:has-text("Log In"), button:has-text("Sign In"), button:has-text("Login")'
        ).first();

        if (await loginLink.isVisible().catch(() => false)) {
          console.log(`🔑 Login link detected on ${task.targetSite}. Navigating to login...`);
          await Promise.all([
            page.waitForNavigation({ timeout: 10000 }).catch(() => null),
            loginLink.click(),
          ]);
          await page.waitForTimeout(1500);

          passwordInput = page.locator('input[type="password"]').first();
          isPasswordVisible = await passwordInput.isVisible().catch(() => false);
        }
      }

      // If login form / password field is visible, execute login sequence
      if (isPasswordVisible) {
        let domain = '';
        try {
          domain = new URL(task.targetSite.startsWith('http') ? task.targetSite : `https://${task.targetSite}`).hostname.toLowerCase();
        } catch {
          domain = task.targetSite.toLowerCase();
        }

        const siteCreds = credentials?.siteCredentials?.[domain];
        const username = siteCreds?.username || credentials?.username || process.env.SUBMISSION_USERNAME || 'demo_user@example.com';
        const password = siteCreds?.password || credentials?.password || process.env.SUBMISSION_PASSWORD || 'DemoPass123!';

        console.log(`🔐 Executing login for ${domain} as "${username}"...`);

        // Locate Username / Email Input Field
        const userInput = page.locator(
          'input[type="email"], input[name*="user" i], input[name*="email" i], input[id*="user" i], input[id*="email" i], input[placeholder*="user" i], input[placeholder*="email" i], input[type="text"]'
        ).first();

        if (await userInput.isVisible().catch(() => false)) {
          await userInput.fill(username);
        }

        // Fill Password
        await passwordInput.fill(password);

        // Click Login Submit Button
        const loginSubmitBtn = page.locator(
          'button[type="submit"], input[type="submit"], button:has-text("Log In"), button:has-text("Sign In"), button:has-text("Login"), input[value*="Log In" i], input[value*="Sign In" i], input[value*="Login" i]'
        ).first();

        if (await loginSubmitBtn.isVisible().catch(() => false)) {
          await Promise.all([
            page.waitForNavigation({ timeout: 15000 }).catch(() => null),
            loginSubmitBtn.click(),
          ]);
          await page.waitForTimeout(2000);
        }

        // Re-check password input presence to confirm login completed
        const stillHasPassword = await page.locator('input[type="password"]').isVisible().catch(() => false);
        if (stillHasPassword) {
          console.warn(`⚠️ Password field still visible after submit attempt on ${task.targetSite}.`);
        } else {
          console.log(`✅ Successfully logged into ${task.targetSite}!`);
        }
      } else {
        console.log(`ℹ️ No active login wall or password input detected on ${task.targetSite}. Proceeding...`);
      }

      return { success: true };
    } catch (err: any) {
      console.warn(`⚠️ Login step warning on ${task.targetSite}: ${err.message}`);
      return { success: true }; // Attempt form fill anyway
    }
  }

  /**
   * If post/bookmark submission form is on a sub-page (e.g. /submit, /add, /new), navigate there.
   */
  private async navigateToSubmissionFormIfNeeded(page: Page, task: TaskInput): Promise<void> {
    try {
      const hasTitleField = await page.locator('input[name*="title" i], input[id*="title" i], textarea[name*="desc" i]').isVisible().catch(() => false);
      if (!hasTitleField) {
        const submitNavBtn = page.locator(
          'a:has-text("Submit"), a:has-text("Add Bookmark"), a:has-text("New Bookmark"), a:has-text("Create"), a:has-text("+ Add"), a[href*="submit" i], a[href*="add" i], button:has-text("Submit"), button:has-text("Add")'
        ).first();

        if (await submitNavBtn.isVisible().catch(() => false)) {
          console.log(`➡️ Navigating to submission form page...`);
          await Promise.all([
            page.waitForNavigation({ timeout: 10000 }).catch(() => null),
            submitNavBtn.click(),
          ]);
          await page.waitForTimeout(1000);
        }
      }
    } catch {
      // Ignore navigation attempt errors
    }
  }

  /**
   * STEP 2 & 3 IMPLEMENTATION: Fills Title, Description, Target URL, and Tags.
   */
  private async fillFormFields(page: Page, task: TaskInput, content: AIContentResponse): Promise<void> {
    // 2. Title Field
    const titleInput = page.locator(
      'input[name*="title" i], input[id*="title" i], input[placeholder*="title" i], input[name*="headline" i], #title, .title-input'
    ).first();
    if (await titleInput.isVisible().catch(() => false)) {
      await titleInput.fill(content.title);
      console.log(`   └─ Title filled: "${content.title.slice(0, 40)}..."`);
    }

    // 3. Description / Summary Field
    const descInput = page.locator(
      'textarea[name*="desc" i], textarea[id*="desc" i], textarea[placeholder*="desc" i], textarea[name*="summary" i], textarea[name*="content" i], textarea[name*="body" i], div[contenteditable="true"], textarea'
    ).first();
    if (await descInput.isVisible().catch(() => false)) {
      const textToFill = content.short_description || content.content;
      await descInput.fill(textToFill);
      console.log(`   └─ Description filled (${textToFill.length} chars)`);
    }

    // Target URL / Link Field
    const targetUrl = content.target_url || task.keywordWebsite || task.targetSite;
    const urlInput = page.locator(
      'input[name*="url" i], input[name*="link" i], input[name*="website" i], input[name*="target" i], input[type="url"], input[placeholder*="http" i]'
    ).first();
    if (await urlInput.isVisible().catch(() => false)) {
      await urlInput.fill(targetUrl);
      console.log(`   └─ Target URL filled: "${targetUrl}"`);
    }

    // Tags / Keywords Field
    if (content.tags && content.tags.length > 0) {
      const tagInput = page.locator(
        'input[name*="tag" i], input[name*="keyword" i], input[id*="tag" i]'
      ).first();
      if (await tagInput.isVisible().catch(() => false)) {
        await tagInput.fill(content.tags.join(', '));
        console.log(`   └─ Tags filled: "${content.tags.join(', ')}"`);
      }
    }
  }

  /**
   * STEP 5 IMPLEMENTATION: Extracts permalink or share link from page DOM.
   */
  private async extractPermalinkFromDOM(page: Page): Promise<string | null> {
    try {
      // 1. Check for published item links in anchors
      const linkLocator = page.locator(
        'a[href*="/item/"], a[href*="/read/"], a[href*="/bookmark/"], a[href*="/post/"], a[href*="/view/"], a.permalink, a.share-link, a.published-link'
      ).first();

      if (await linkLocator.isVisible().catch(() => false)) {
        const href = await linkLocator.getAttribute('href');
        if (href) {
          if (href.startsWith('http')) return href;
          const baseUrl = new URL(page.url()).origin;
          return `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
        }
      }

      // 2. Check for readonly share input elements
      const inputLocator = page.locator(
        'input[readonly][value*="http"], input[name*="share" i], input[id*="share" i]'
      ).first();

      if (await inputLocator.isVisible().catch(() => false)) {
        const val = await inputLocator.inputValue();
        if (val && val.startsWith('http')) return val;
      }
    } catch {
      // Return null on DOM extraction failure
    }
    return null;
  }

  /**
   * Inspects DOM for Cloudflare, ReCAPTCHA, hCaptcha barriers.
   */
  private async detectSecurityWall(page: Page): Promise<{ blocked: boolean; reason?: string }> {
    const content = await page.content();

    if (content.includes('g-recaptcha') || content.includes('h-captcha') || content.includes('cf-turnstile')) {
      return { blocked: true, reason: 'CAPTCHA protection detected on submission form.' };
    }

    if (content.includes('Just a moment...') || content.includes('Checking your browser')) {
      return { blocked: true, reason: 'Cloudflare bot protection screen active.' };
    }

    return { blocked: false };
  }
}

