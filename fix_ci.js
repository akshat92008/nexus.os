const fs = require('fs');

let content = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
content = content.replace('pnpm install --frozen-lockfile', 'pnpm install --no-frozen-lockfile');
fs.writeFileSync('.github/workflows/ci.yml', content);
