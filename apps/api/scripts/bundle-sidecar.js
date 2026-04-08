import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('🏗️ Starting sidecar bundle...');
  
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, '../src/index.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: path.join(__dirname, '../dist/nexus-api-bundle.cjs'),
      format: 'cjs',
      // Mark specific large/binary libs as external if they cause issues
      external: [
        'bullmq', // BullMQ has some deep dependencies that sometimes prefer being external
        'ioredis'
      ],
      loader: {
        '.node': 'copy',
      },
      banner: {
        js: '// Nexus OS API Sidecar Bundle',
      },
      minify: process.env.NODE_ENV === 'production',
      sourcemap: true,
    });
    
    console.log('✅ Bundle completed: dist/nexus-api-bundle.cjs');
    console.log('💡 To create the binary, run: npx pkg apps/api/dist/nexus-api-bundle.cjs --target node18-macos-x64 --output src-tauri/binaries/nexus-api-x86_64-apple-darwin');
    
  } catch (err) {
    console.error('❌ Bundle failed:', err);
    process.exit(1);
  }
}

main();
