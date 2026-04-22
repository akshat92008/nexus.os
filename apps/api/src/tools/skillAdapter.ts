import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExternalSkill {
  name: string;
  scriptPath: string; // Path to the copied OpenClaw Python/JS script
  requires_approval: boolean;
  undoScriptPath?: string; // Optional: How to reverse this specific skill
}

export async function runExternalSkill(skill: ExternalSkill, params: any) {
  console.log(`🔌 [ADAPTER] Invoking External Skill: ${skill.name}`);
  
  // Convert params to JSON string to pass to the script
  const paramString = JSON.stringify(params).replace(/"/g, '\\"');
  
  try {
    // Execute the copied script
    const { stdout, stderr } = await execAsync(`node ${skill.scriptPath} "${paramString}"`);
    
    if (stderr) {
      console.warn(`[ADAPTER WARNING] ${skill.name}: ${stderr}`);
    }

    // Parse the output back into our DAG format
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`❌ [ADAPTER ERROR] ${skill.name} failed:`, error);
    throw error;
  }
}
