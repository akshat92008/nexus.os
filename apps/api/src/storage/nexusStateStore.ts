/**
 * Nexus OS — Nexus State Store (Modular Facade)
 *
 * This file maintains the legacy API for the storage layer while delegating
 * the actual implementation to specialized sub-modules.
 */

import { userStateStore } from './userStateStore.js';
import { missionStore } from './missionStore.js';
import { getSupabase } from './supabaseClient.js';

class NexusStateStoreFacade {
  // Client Access
  getSupabaseClient = getSupabase;

  // User State Logic
  getUserState = userStateStore.getUserState.bind(userStateStore);
  syncUserState = userStateStore.syncUserState.bind(userStateStore);
  upsertWorkspace = userStateStore.upsertWorkspace.bind(userStateStore);
  deleteWorkspace = userStateStore.deleteWorkspace.bind(userStateStore);

  // Mission & Task Logic
  createMission = missionStore.createMission.bind(missionStore);
  updateMissionStatus = missionStore.updateMissionStatus.bind(missionStore);
  createTask = missionStore.createTask.bind(missionStore);
  updateTaskStatus = missionStore.updateTaskStatus.bind(missionStore);
  completeTaskAtomics = missionStore.completeTaskAtomics.bind(missionStore);
  updateTaskCheckpoint = missionStore.updateTaskCheckpoint.bind(missionStore);
  storeArtifact = missionStore.storeArtifact.bind(missionStore);
  fetchArtifactsByContext = missionStore.fetchArtifactsByContext.bind(missionStore);
  getTask = missionStore.getTask.bind(missionStore);
  getMissionTasks = missionStore.getMissionTasks.bind(missionStore);
  
  // Schedules
  upsertSchedule = missionStore.upsertSchedule.bind(missionStore);
  listAllSchedules = missionStore.listAllSchedules.bind(missionStore);
}

export const nexusStateStore = new NexusStateStoreFacade();
