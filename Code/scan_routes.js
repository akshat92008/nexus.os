const fs = require('fs');
const content = fs.readFileSync('apps/api/src/index.ts', 'utf8');

const routeOptions = ['get', 'post', 'put', 'delete'];
const routes = [];
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const method of routeOptions) {
    const match = line.match(new RegExp(`app\\.${method}\\(['"\`]+([^'"\`]+)['"\`]+([^\\)]*)`));
    if (match) {
      const path = match[1];
      const rest = match[2];
      const hasAuth = rest.includes('requireAuth') || line.includes('requireAuth');
      routes.push({ method: method.toUpperCase(), path, hasAuth, line: i + 1 });
    }
  }
}

const methodPathMap = {};
routes.forEach(r => {
  const key = `${r.method} ${r.path}`;
  if (!methodPathMap[key]) methodPathMap[key] = [];
  methodPathMap[key].push(r);
});

console.log("=== DUPLICATE ROUTES ===");
let hasDuplicates = false;
for (const [key, instances] of Object.entries(methodPathMap)) {
  if (instances.length > 1) {
    hasDuplicates = true;
    console.log(`Duplicate: ${key} at lines ${instances.map(i => i.line).join(', ')}`);
  }
}
if (!hasDuplicates) console.log("No duplicate routes found.");

console.log("\n=== TOTAL ROUTE COUNT ===");
console.log(routes.length);

console.log("\n=== ALL ROUTES & AUTH STATUS ===");
routes.forEach(r => {
  console.log(`${r.method.padEnd(6)} ${r.path.padEnd(35)} [Auth: ${r.hasAuth ? 'requireAuth' : 'public'}] (Line ${r.line})`);
});
