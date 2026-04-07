import type { AppWindowState, NexusInboxEntry, ScheduleSnapshot, UserStateSnapshot, Workspace } from '@nexus-os/types';
export declare function createWorkspaceShell(params: {
    title: string;
    goalType: Workspace['goalType'];
    windowType: AppWindowState['windowType'];
}): Workspace;
declare class NexusStateStore {
    private db;
    private loaded;
    private writeQueue;
    private ensureLoaded;
    private flush;
    private mutate;
    private getUserRef;
    getUserState(userId: string): Promise<UserStateSnapshot>;
    syncUserState(userId: string, patch: Partial<UserStateSnapshot>): Promise<UserStateSnapshot>;
    upsertWorkspace(userId: string, workspace: Workspace): Promise<UserStateSnapshot>;
    createWorkspaceWindow(params: {
        userId: string;
        title: string;
        goalType: Workspace['goalType'];
        windowType: AppWindowState['windowType'];
    }): Promise<{
        state: UserStateSnapshot;
        workspace: Workspace;
        window: AppWindowState;
    }>;
    deleteWorkspace(userId: string, workspaceId: string): Promise<UserStateSnapshot>;
    setActiveWorkspace(userId: string, workspaceId: string | null): Promise<UserStateSnapshot>;
    upsertWindow(userId: string, window: AppWindowState): Promise<UserStateSnapshot>;
    closeWindow(userId: string, workspaceId: string): Promise<UserStateSnapshot>;
    upsertSchedule(userId: string, schedule: ScheduleSnapshot): Promise<UserStateSnapshot>;
    removeSchedule(userId: string, scheduleId: string): Promise<UserStateSnapshot>;
    listAllSchedules(): Promise<Array<{
        userId: string;
        schedule: ScheduleSnapshot;
    }>>;
    installAgent(userId: string, agentId: string): Promise<UserStateSnapshot>;
    addInboxEntry(userId: string, entry: Omit<NexusInboxEntry, 'id' | 'timestamp' | 'read'> & {
        timestamp?: string;
        read?: boolean;
    }): Promise<UserStateSnapshot>;
    markInboxRead(userId: string, entryId: string): Promise<UserStateSnapshot>;
    clearInbox(userId: string): Promise<UserStateSnapshot>;
    completeNextAction(userId: string, workspaceId: string, actionId: string, message?: string): Promise<Workspace | null>;
}
export declare const nexusStateStore: NexusStateStore;
export {};
//# sourceMappingURL=nexusStateStore.d.ts.map