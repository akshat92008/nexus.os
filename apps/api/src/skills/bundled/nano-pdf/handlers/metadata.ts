// REQUIRES: pdf-parse
import pdfParse from 'pdf-parse';
import { promises as fs } from 'fs';

export default async function metadata(params: { path: string }): Promise<any> {
  const { path: filePath } = params;

  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);

  return {
    success: true,
    path: filePath,
    title: data.info?.Title || null,
    author: data.info?.Author || null,
    subject: data.info?.Subject || null,
    creator: data.info?.Creator || null,
    producer: data.info?.Producer || null,
    pages: data.numpages,
    version: data.info?.PDFFormatVersion || null,
    keywords: data.info?.Keywords || null,
    creation_date: data.info?.CreationDate || null,
    modification_date: data.info?.ModDate || null
  };
}
