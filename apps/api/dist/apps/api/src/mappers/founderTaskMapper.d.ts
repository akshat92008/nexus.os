/**
 * Founder Experience Layer — Task Mapper
 *
 * Converts a FounderIntent into a list of TaskNodes for the orchestrator.
 * This ensures that business missions are handled by agents with
 * a startup/operator mindset.
 */
import type { TaskNode } from '@nexus-os/types';
import type { FounderIntent } from '../intent/founderIntentParser.js';
export declare function mapFounderIntentToTasks(intent: FounderIntent): TaskNode[];
//# sourceMappingURL=founderTaskMapper.d.ts.map