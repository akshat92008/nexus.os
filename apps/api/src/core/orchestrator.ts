import { sagaManager, ObservationResult } from '../services/SagaManager.js';
import { logger } from '../logger.js';

export interface Goal {
    id: string;
    intent: string;
}

/**
 * The main RAOV loop runner (Reason -> Act -> Observe -> Verify).
 */
export async function executeRAOVLoop(goal: Goal): Promise<void> {
    logger.info(`[Orchestrator] Starting RAOV Loop for goal: ${goal.id}`);

    let loopActive = true;
    let correctionAttempts = 0;
    const MAX_CORRECTIONS = 3;

    while (loopActive) {
        // 1. REASON
        logger.info(`[Orchestrator] Reasoning next step...`);
        const actionToTake = { toolId: 'shell_execute', params: { cmd: 'ls' }, undoParams: { cmd: 'rm ls_output' } };

        // 2. ACT
        logger.info(`[Orchestrator] Acting: ${actionToTake.toolId}`);
        await sagaManager.logAction(goal.id, actionToTake.toolId, actionToTake.params, actionToTake.undoParams);

        // Execute actual action (mocked)
        const mockExecutionResult: ObservationResult = { exitCode: 0, output: "Success", errorOutput: "" };

        // 3. OBSERVE
        logger.info(`[Orchestrator] Observing results...`);

        // 4. VERIFY
        logger.info(`[Orchestrator] Verifying state...`);
        const nextState = await sagaManager.verifyObservation(goal.id, mockExecutionResult);

        switch (nextState) {
            case 'PROCEED':
                logger.info(`[Orchestrator] Step successful. Proceeding.`);
                loopActive = false; // Goal achieved for this mock
                break;
            case 'CORRECT':
                if (correctionAttempts < MAX_CORRECTIONS) {
                    correctionAttempts++;
                    logger.warn(`[Orchestrator] Attempting correction ${correctionAttempts}/${MAX_CORRECTIONS}`);
                    // Loop continues to reason about the correction
                } else {
                    logger.error(`[Orchestrator] Max corrections reached. Forcing ROLLBACK.`);
                    await sagaManager.executeRollback(goal.id);
                    loopActive = false;
                }
                break;
            case 'ROLLBACK':
                await sagaManager.executeRollback(goal.id);
                loopActive = false;
                break;
        }
    }
}
