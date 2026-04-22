// REQUIRES: puppeteer
import path from 'path';

interface ScreenshotParams {
  url: string;
  selector?: string;
  full_page?: boolean;
  output_path?: string;
}

export default async function screenshot(params: ScreenshotParams, context: { config: Record<string, any> }): Promise<any> {
  const { url, selector, full_page = true, output_path } = params;
  const headless = context.config.headless !== false;

  try {
    const puppeteer = await import('puppeteer');

    const browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const outPath = output_path || path.join('/tmp', `screenshot-${Date.now()}.png`);

    if (selector) {
      const element = await page.$(selector);
      if (!element) {
        await browser.close();
        throw new Error(`Element with selector "${selector}" not found`);
      }
      await element.screenshot({ path: outPath });
    } else {
      await page.screenshot({ path: outPath, fullPage: full_page });
    }

    await browser.close();

    return {
      success: true,
      url,
      output_path: outPath,
      full_page,
      selector
    };
  } catch (err: any) {
    throw new Error(`Screenshot failed: ${err.message}. Ensure puppeteer is installed.`);
  }
}
