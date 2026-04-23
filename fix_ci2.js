const fs = require('fs');

let content = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

content = content.replace(
  'jobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:',
  'jobs:\n  build:\n    runs-on: ubuntu-latest\n    env:\n      FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true\n    steps:'
);

fs.writeFileSync('.github/workflows/ci.yml', content);
