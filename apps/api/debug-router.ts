import dotenv from 'dotenv';
dotenv.config({ path: '/Users/ashishsingh/Desktop/nexus-os/apps/api/.env' });
import { decomposeGoal } from './src/semanticRouter.ts';

async function test() {
  console.log('Testing decomposeGoal...');
  try {
    const plan = await decomposeGoal('/deploy research on antigravity');
    console.log('Returned plan:', JSON.stringify(plan, null, 2));
  } catch(e) {
    console.error('Error:', e);
  }
}
test();
