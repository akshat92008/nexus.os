// REQUIRES: puppeteer
import { logger } from '../../../logger.js';

interface NavigateParams {
  url: string;
  wait_for?: string;
  timeout?: number;
}

export default async function navigate(params: NavigateParams, context: { config: Record<string, any> }): Promise<any> {
  const { url, wait_for, timeout = 30000 } = params;
  const headless = context.config.headless !== false;

  try {
    const puppeteer = await import('puppeteer');

    const browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent(context.config.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout });

    if (wait_for) {
      await page.waitForSelector(wait_for, { timeout: 10000 }).catch(() => {
        logger.warn(`[Browser] Selector "${wait_for}" not found within 10s`);
      });
    }

    const title = await page.title();
    const content = await page.evaluate(() => {
      // Remove script/style tags for cleaner text
      const scripts = document.querySelectorAll('script, style, nav, footer, iframe, noscript');
      scripts.forEach(el => el.remove());
      return document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 50000) || '';
    });

    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({
          text: (a as HTMLAnchorElement).innerText.trim(),
          href: (a as HTMLAnchorElement).href
        }))
        .filter(l => l.href.startsWith('http'))
        .slice(0, 100)
    );

    await browser.close();

    return {
      success: true,
      url,
      title,
      content: content.slice(0, 30000), // Truncate for token limits
      links: links.slice(0, 50),
      links_found: links.length
    };
  } catch (err: any) {
    throw new Error(`Browser navigation failed: ${err.message}. Ensure puppeteer is installed.`);
  }
}
