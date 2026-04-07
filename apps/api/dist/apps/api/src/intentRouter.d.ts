/**
 * NexusOS — Intent Router (Multi-Persona Hub)
 *
 * Central routing layer to select the correct persona (Student | Founder | Developer).
 */
import type { TaskNode } from '@nexus-os/types';
export type OSMode = 'student' | 'founder' | 'developer';
export interface RoutedIntent {
    intent: any;
    tasks: TaskNode[];
    formatter: (synthesis: any) => any;
}
export declare function routeIntent(input: string, mode: OSMode): RoutedIntent;
//# sourceMappingURL=intentRouter.d.ts.map