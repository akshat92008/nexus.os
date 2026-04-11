
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { llmRouter, MODEL_FAST } from './llm/LLMRouter.js';
import { getSupabase } from './storage/supabaseClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runDiagnostics() {
  console.log('\n🔍 Nexus OS — System Diagnostics\n');
  let failures = 0;

  // 1. Environment Check
  console.log('1. Environment Check:');
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'GROQ_API_KEY'];
  for (const env of required) {
    if (!process.env[env]) {
      console.log(`   ❌ ${env} is missing!`);
      failures++;
    } else {
      console.log(`   ✅ ${env} is present.`);
    }
  }

  // 2. Supabase Check
  console.log('\n2. Supabase Connectivity:');
  try {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Could not initialize Supabase client');
    
    const { data: tables, error } = await (supabase as any).from('nexus_missions').select('id').limit(1);
    if (error) {
       console.log(`   ❌ Failed to query "nexus_missions": ${error.message}`);
       console.log('      HINT: Have you run the SQL DDL in your Supabase dashboard?');
       failures++;
    } else {
       console.log('   ✅ Successfully queried "nexus_missions" table.');
    }
  } catch (err: any) {
    console.log(`   ❌ Supabase error: ${err.message}`);
    failures++;
  }

  // 3. LLM Connectivity (Groq)
  console.log('\n3. LLM Connectivity (Groq):');
  try {
    // We attempt a very tiny check
    const response = await llmRouter.call({
      system: 'Health check.',
      user: 'Respond with "OK"',
      model: MODEL_FAST,
      maxTokens: 5
    });
    console.log(`   ✅ LLM Router responded: "${response.content.trim()}"`);
  } catch (err: any) {
    console.log(`   ❌ LLM Router failed: ${err.message}`);
    if (err.message.includes('Breaker is open')) {
      console.log('      HINT: The circuit breaker is open. Wait 30s for it to reset.');
    } else if (err.message.includes('401')) {
      console.log('      HINT: Invalid API Key. Check your GROQ_API_KEY format.');
    }
    failures++;
  }

  console.log(`\n🏁 Diagnostics complete. Failures: ${failures}\n`);
  if (failures === 0) {
    console.log('✅ YOUR SYSTEM IS READY FOR MISSIONS! 🚀\n');
  } else {
    console.log('❌ SYSTEM NOT READY. Please fix the errors above.\n');
  }
}

runDiagnostics().catch(err => {
  console.error('Fatal diagnostic error:', err);
  process.exit(1);
});
