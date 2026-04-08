/**
 * Nexus OS — Production Dry-Run Test
 * 
 * Verifies the full loop from Orchestration → Redis → Worker → Supabase.
 */

import 'dotenv/config';
import { startDurableMission } from '../orchestrator.js';
import { nexusStateStore } from '../storage/nexusStateStore.js';
import { eventBus } from '../events/eventBus.js';

async function testDrive() {
  const testGoal = "Research the latest trends in autonomous agent memory management.";
  const userId   = "test-user-prod-001";
  
  console.log('🏁 Starting Production Dry-Run...');
  console.log(`🎯 Goal: ${testGoal}`);

  try {
    // 1. Trigger Orchestration
    const result = await startDurableMission(testGoal, userId, 'student');
    const { missionId } = result;

    console.log(`✅ Mission Created: ${missionId}`);

    // 2. Listen to Event Stream
    console.log('📡 Subscribing to event stream...');
    const eventHandler = (event: any) => {
      console.log(`[EVENT] [${event.type}]`, event.message || event.taskLabel || '');
      if (event.type === 'done' || event.type === 'error') {
        console.log('⏹️ Test Lifecycle complete.');
        process.exit(event.type === 'done' ? 0 : 1);
      }
    };

    await eventBus.subscribe(missionId, eventHandler);

    // 3. Verify Persistence (Wait 2 seconds for workers to start)
    setTimeout(async () => {
      const mission = await nexusStateStore.getMissionById(missionId);
      if (mission) {
        console.log(`📊 Persistence Verified: Mission status is ${mission.status}`);
      } else {
        console.error('❌ Persistence Failure: Mission not found in DB');
      }
    }, 2000);

  } catch (err) {
    console.error('❌ Dry-run failed:', err);
    process.exit(1);
  }
}

testDrive();
