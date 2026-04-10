import { getSupabase } from './storage/supabaseClient.js';
 
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

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    try {
      const supabase = await getSupabase();
      await supabase.from('pending_approvals').upsert({
        mission_id: missionId,
        task_id: taskId,
        status: 'pending',
        expires_at: expiresAt
      });
    } catch (err) {
      console.error('[ApprovalGuard] ❌ Failed to persist pending approval:', err);
    }
 
    return new Promise((resolve) => {
      this.pendingApprovals.set(key, resolve);
      
      // Cleanup timeout after 10 minutes to prevent memory leaks
      setTimeout(() => {
        if (this.pendingApprovals.has(key)) {
          console.warn(`[ApprovalGuard] ⚠️  Approval timeout for ${key} after 10 mins. Auto-REJECTING for safety.`);
          this.resolve(missionId, taskId, false);
        }
      }, 10 * 60 * 1000);
    });
  }
 
  /**
   * Resolves a pending approval. Called by the API route.
   */
  async resolve(missionId: string, taskId: string, approved: boolean): Promise<boolean> {
    const key = `${missionId}:${taskId}`;
    const resolver = this.pendingApprovals.get(key);
    
    try {
      const supabase = await getSupabase();
      await supabase.from('pending_approvals')
        .update({ status: approved ? 'approved' : 'rejected' })
        .match({ mission_id: missionId, task_id: taskId });
    } catch (err) {
      console.error('[ApprovalGuard] ❌ Failed to update approval status in DB:', err);
    }

    if (resolver) {
      console.log(`[ApprovalGuard] ▶️  Mission "${missionId}" resumed for task "${taskId}" (Approved: ${approved})`);
      resolver(approved);
      this.pendingApprovals.delete(key);
      return true;
    }
    
    console.warn(`[ApprovalGuard] No pending approval for ${key} — already resolved or timed out.`);
    return false;
  }

  /**
   * Marks stale pending approvals as rejected on startup or periodically.
   */
  async cleanupStaleApprovals(): Promise<void> {
    try {
      console.log('[ApprovalGuard] 🧹 Cleaning up stale approvals...');
      const supabase = await getSupabase();
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('pending_approvals')
        .update({ status: 'rejected' })
        .eq('status', 'pending')
        .lt('created_at', tenMinutesAgo);

      if (error) throw error;
      console.log(`[ApprovalGuard] ✅ Stale approvals cleanup complete.`);
    } catch (err) {
      console.error('[ApprovalGuard] ❌ Stale approvals cleanup failed:', err);
    }
  }
}
 
export const approvalGuard = ApprovalGuard.getInstance();
