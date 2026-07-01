import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const USER_DATA_DIR = path.join(process.cwd(), 'user_data');

/**
 * Launches a persistent Chromium browser context with anti-detection headers,
 * user agent settings, and local cookie/state persistence.
 * @returns {Promise<{context: BrowserContext, page: Page}>} - Browser context and primary page.
 */
export async function launchBrowser() {
  // Ensure user data directory exists
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  console.log(`🚀 Launching persistent Chromium context from: ${USER_DATA_DIR}`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false, // Must be visible for captcha/interaction
    viewport: null, // Allow viewport to occupy the maximized browser window
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled', // Evade navigator.webdriver detection
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    ignoreDefaultArgs: ['--enable-automation'], // Hide the "Chrome is being controlled by automated software" banner
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  // Modify context to add stealth properties on every new page
  await context.addInitScript(() => {
    // Overwrite the navigator.webdriver property to undefined
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    // Add chrome runtime emulation
    window.chrome = {
      runtime: {},
    };
  });

  // Get or create primary page
  let page;
  const pages = context.pages();
  if (pages.length > 0) {
    page = pages[0];
  } else {
    page = await context.newPage();
  }

  // Set default timeout for pages to 30 seconds
  page.setDefaultTimeout(30000);

  return { context, page };
}
