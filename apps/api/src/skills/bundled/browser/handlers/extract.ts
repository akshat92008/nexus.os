// REQUIRES: puppeteer
interface ExtractParams {
  url: string;
  selectors: Record<string, string>;
  attributes?: string[];
}

export default async function extract(params: ExtractParams, context: { config: Record<string, any> }): Promise<any> {
  const { url, selectors, attributes = ['textContent', 'href'] } = params;
  const headless = context.config.headless !== false;

  try {
    const puppeteer = await import('puppeteer');

    const browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const results: Record<string, any[]> = {};

    for (const [name, selector] of Object.entries(selectors)) {
      const elements = await page.$$(selector);
      results[name] = [];

      for (const el of elements) {
        const data: Record<string, any> = {};

        for (const attr of attributes) {
          if (attr === 'textContent' || attr === 'text') {
            const text = await el.evaluate(node => (node as HTMLElement).textContent?.trim());
            data.text = text;
          } else if (attr === 'href' || attr === 'src') {
            const val = await el.evaluate((node, a) => (node as any)[a], attr);
            data[attr] = val;
          } else {
            const val = await el.getProperty(attr).then(p => p.jsonValue().catch(() => null));
            data[attr] = val;
          }
        }

        results[name].push(data);
      }
    }

    await browser.close();

    return {
      success: true,
      url,
      selectors,
      results,
      total_elements: Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
    };
  } catch (err: any) {
    throw new Error(`Data extraction failed: ${err.message}. Ensure puppeteer is installed.`);
  }
}
