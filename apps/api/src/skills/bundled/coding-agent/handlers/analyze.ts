import { promises as fs } from 'fs';
import path from 'path';

interface AnalysisResult {
  totalLines: number;
  blankLines: number;
  commentLines: number;
  codeLines: number;
  functions: number;
  complexity: 'low' | 'medium' | 'high';
}

export default async function analyze(params: { path: string }): Promise<any> {
  const { path: targetPath } = params;
  const stats = await fs.stat(targetPath);

  if (stats.isDirectory()) {
    const files = await fs.readdir(targetPath);
    let totalLines = 0, totalBlank = 0, totalComment = 0, totalCode = 0;

    for (const file of files.filter(f => f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.py'))) {
      const result = await analyzeFile(path.join(targetPath, file));
      totalLines += result.totalLines;
      totalBlank += result.blankLines;
      totalComment += result.commentLines;
      totalCode += result.codeLines;
    }

    return {
      success: true,
      path: targetPath,
      type: 'directory',
      fileCount: files.length,
      totalLines,
      blankLines: totalBlank,
      commentLines: totalComment,
      codeLines: totalCode
    };
  }

  const result = await analyzeFile(targetPath);
  return {
    success: true,
    path: targetPath,
    type: 'file',
    ...result
  };
}

async function analyzeFile(filePath: string): Promise<AnalysisResult> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  let blank = 0, comment = 0, code = 0, functions = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      blank++;
    } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
      comment++;
    } else {
      code++;
    }
    if (/^\s*(function|async function|const.*=.*=>|def |class )/.test(trimmed)) {
      functions++;
    }
  }

  const ratio = functions > 0 ? code / functions : code;
  const complexity = ratio > 50 ? 'high' : ratio > 20 ? 'medium' : 'low';

  return {
    totalLines: lines.length,
    blankLines: blank,
    commentLines: comment,
    codeLines: code,
    functions,
    complexity
  };
}
