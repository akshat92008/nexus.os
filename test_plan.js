const fs = require('fs');

console.log("Checking CI yaml update...");
let content = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
if (content.includes('pnpm install --no-frozen-lockfile')) {
  console.log("CI yaml update correct.");
} else {
  console.log("CI yaml update failed.");
}
