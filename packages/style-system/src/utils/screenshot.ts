/**
 * Screenshot utility using Playwright
 *
 * DESIGN PATTERNS:
 * - Utility function for browser automation
 * - Factory pattern for browser selection
 * - Options pattern for configuration
 *
 * CODING STANDARDS:
 * - Use async/await for browser operations
 * - Clean up resources (close browser) in finally block
 * - Support multiple browsers (chromium, firefox, webkit)
 *
 * AVOID:
 * - Leaving browser instances open
 * - Hardcoding viewport sizes
 */

import { chromium, firefox, webkit, type Browser, type BrowserType } from 'playwright';
import sharp from 'sharp';
import path from 'node:path';

export interface ScreenshotOptions {
  url: string;
  output: string;
  width?: number;
  height?: number;
  fullPage?: boolean;
  browser?: 'chromium' | 'firefox' | 'webkit';
  waitTime?: number;
  darkMode?: boolean;
  mobile?: boolean;
  generateThumbnail?: boolean;
  thumbnailWidth?: number;
  thumbnailQuality?: number;
  base64?: boolean;
}

export interface ScreenshotResult {
  imagePath: string;
  thumbnailPath?: string;
  base64?: string;
}

const browsers: Record<string, BrowserType> = {
  chromium,
  firefox,
  webkit,
};

/**
 * Browser launch configurations to try in order of preference.
 * Prefers system-installed Chrome before falling back to Playwright's bundled browsers.
 */
const browserLaunchConfigs = [
  { browserType: chromium, channel: 'chrome', name: 'System Chrome' },
  { browserType: chromium, channel: undefined, name: 'Playwright Chromium' },
  { browserType: firefox, channel: undefined, name: 'Playwright Firefox' },
] as const;

/**
 * Attempts to launch a browser, trying multiple configurations in order of preference.
 * @returns Launched browser instance
 * @throws Error if no browser can be launched
 */
async function launchBrowserWithFallback(): Promise<Browser> {
  const errors: string[] = [];

  for (const config of browserLaunchConfigs) {
    try {
      const browser = await config.browserType.launch({
        headless: true,
        channel: config.channel,
      });
      console.log(`[screenshot] Using ${config.name}`);
      return browser;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${config.name}: ${message}`);
    }
  }

  throw new Error(
    `No browser available. Tried:\n${errors.join('\n')}\n\nPlease install Chrome, or run 'npx playwright install chromium'`,
  );
}

export async function takeScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
  const {
    url,
    output,
    width = 1280,
    height = 800,
    fullPage = false,
    browser: browserName = 'chromium',
    waitTime = 1000,
    darkMode = false,
    mobile = false,
    generateThumbnail = false,
    thumbnailWidth = 400,
    thumbnailQuality = 80,
    base64 = false,
  } = options;

  let browser: Browser | null = null;

  try {
    // Use fallback browser detection for chromium (default)
    if (browserName === 'chromium') {
      browser = await launchBrowserWithFallback();
    } else {
      const browserType = browsers[browserName];
      if (!browserType) {
        throw new Error(`Unsupported browser: ${browserName}`);
      }
      browser = await browserType.launch({ headless: true });
    }

    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: darkMode ? 'dark' : 'light',
      isMobile: mobile,
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    if (waitTime > 0) {
      await page.waitForTimeout(waitTime);
    }

    const screenshotBuffer = await page.screenshot({
      path: output,
      fullPage,
    });

    const result: ScreenshotResult = {
      imagePath: output,
    };

    // Generate thumbnail if requested
    if (generateThumbnail) {
      const ext = path.extname(output);
      const thumbnailPath = output.replace(ext, `-thumb${ext}`);

      await sharp(screenshotBuffer)
        .resize(thumbnailWidth)
        .jpeg({ quality: thumbnailQuality })
        .toFile(thumbnailPath.replace(ext, '.jpg'));

      result.thumbnailPath = thumbnailPath.replace(ext, '.jpg');
    }

    // Generate base64 if requested
    if (base64) {
      result.base64 = screenshotBuffer.toString('base64');
    }

    return result;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
