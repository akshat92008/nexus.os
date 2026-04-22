import { promises as fs } from 'fs';
import path from 'path';

export default async function save(params: { content: string; output_path: string; append?: boolean }): Promise<any> {
  const { content, output_path, append = false } = params;
  await fs.mkdir(path.dirname(output_path), { recursive: true });

  if (append) {
    await fs.appendFile(output_path, content + '\n', 'utf-8');
  } else {
    await fs.writeFile(output_path, content, 'utf-8');
  }

  const stats = await fs.stat(output_path);

  return {
    success: true,
    output_path,
    bytes: stats.size,
    append
  };
}
