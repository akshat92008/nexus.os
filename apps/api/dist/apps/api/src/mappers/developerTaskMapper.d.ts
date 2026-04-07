/**
 * Developer Experience Layer — Task Mapper
 *
 * Converts a DeveloperIntent into a list of TaskNodes for the orchestrator.
 * This ensures that coding missions are handled by agents with
 * production-level standards.
 */
import type { TaskNode } from '@nexus-os/types';
import type { DeveloperIntent } from '../intent/developerIntentParser.js';
export declare function mapDeveloperIntentToTasks(intent: DeveloperIntent): TaskNode[];
//# sourceMappingURL=developerTaskMapper.d.ts.map