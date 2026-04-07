/**
 * Nexus OS — Approval Guard (HITL Control)
 *
 * Manages the "Strategic Pause" state for missions.
 * Allows the Orchestrator to wait for user intervention before
 * proceeding with high-stakes or high-cost tasks.
 */
 
export class ApprovalGuard {
  private static instance: ApprovalGuard;
  private pendingApprovals = new Map<string, (approved: boolean) => void>();
 
  private constructor() {}
 
  static getInstance(): ApprovalGuard {
    if (!ApprovalGuard.instance) {
      ApprovalGuard.instance = new ApprovalGuard();
    }
    return ApprovalGuard.instance;
  }
 
  /**
   * Waits for a user approval signal for a specific task.
   */
  async wait(missionId: string, taskId: string): Promise<boolean> {
    const key = `${missionId}:${taskId}`;
    console.log(`[ApprovalGuard] ⏸️  Mission "${missionId}" paused for task "${taskId}"`);
 
    return new Promise((resolve) => {
      this.pendingApprovals.set(key, resolve);
      
      // Cleanup timeout after 10 minutes to prevent memory leaks
      setTimeout(() => {
        if (this.pendingApprovals.has(key)) {
          console.warn(`[ApprovalGuard] ⚠️  Approval timeout for ${key} after 10 mins. Resuming as true.`);
          this.resolve(missionId, taskId, true);
        }
      }, 10 * 60 * 1000);
    });
  }
 
  /**
   * Resolves a pending approval. Called by the API route.
   */
  resolve(missionId: string, taskId: string, approved: boolean): boolean {
    const key = `${missionId}:${taskId}`;
    const resolver = this.pendingApprovals.get(key);
    
    if (resolver) {
      console.log(`[ApprovalGuard] ▶️  Mission "${missionId}" resumed for task "${taskId}" (Approved: ${approved})`);
      resolver(approved);
      this.pendingApprovals.delete(key);
      return true;
    }
    
    console.warn(`[ApprovalGuard] ❓ No pending approval found for link ${key}`);
    return false;
  }
}
 
export const approvalGuard = ApprovalGuard.getInstance();
