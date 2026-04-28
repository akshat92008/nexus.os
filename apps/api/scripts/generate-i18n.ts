import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { llmRouter } from '../src/llm/LLMRouter.js';

const LOCALES = ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar', 'hi', 'ru'] as const;

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const localeDir = path.join(scriptDir, '../src/i18n/locales');
  const englishPath = path.join(scriptDir, '../src/i18n/locales-template.en.json');

  const english = JSON.parse(await fs.readFile(englishPath, 'utf8'));

  for (const locale of LOCALES) {
    const translated = await llmRouter.callSimple(
      'Translate the provided locale JSON. Preserve keys exactly, keep JSON valid, and only translate user-facing string values.',
      `Target locale: ${locale}\n\n${JSON.stringify(english)}`,
      'MODEL_POWER',
      true,
    );

    const targetPath = path.join(localeDir, `${locale}.json`);
    await fs.writeFile(targetPath, translated, 'utf8');
    console.log(`Generated ${targetPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
