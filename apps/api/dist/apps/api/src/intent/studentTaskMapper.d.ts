/**
 * Student Experience Layer — Task Mapper
 *
 * Converts a StudentIntent into a list of TaskNodes for the orchestrator.
 * This ensures that student missions are handled by the correct agents
 * with the right output schema.
 */
import type { TaskNode } from '@nexus-os/types';
import type { StudentIntent } from './studentIntentParser.js';
export declare function mapIntentToTasks(intent: StudentIntent): TaskNode[];
//# sourceMappingURL=studentTaskMapper.d.ts.map