// REQUIRES: pdf-parse
import pdfParse from 'pdf-parse';
import { promises as fs } from 'fs';

export default async function extractText(params: { path: string; pages?: number[] }): Promise<any> {
  const { path: filePath, pages } = params;

  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);

  let text = data.text;

  // If specific pages requested, estimate by splitting by page markers
  // Note: pdf-parse gives total text; page-level extraction requires more advanced parsing
  // This is a basic implementation
  if (pages && pages.length > 0 && data.numpages > 1) {
    const lines = text.split('\n');
    const linesPerPage = Math.ceil(lines.length / data.numpages);
    const selectedLines: string[] = [];
    for (const page of pages) {
      const start = (page - 1) * linesPerPage;
      const end = start + linesPerPage;
      selectedLines.push(...lines.slice(start, end));
    }
    text = selectedLines.join('\n');
  }

  return {
    success: true,
    path: filePath,
    pages: data.numpages,
    text: text.slice(0, 100000), // Limit output
    text_length: text.length
  };
}
