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

  const browserType = browsers[browserName];
  if (!browserType) {
    throw new Error(`Unsupported browser: ${browserName}`);
  }

  let browser: Browser | null = null;

  try {
    browser = await browserType.launch({ headless: true });

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
