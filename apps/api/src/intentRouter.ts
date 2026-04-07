/**
 * NexusOS — Intent Router (Multi-Persona Hub)
 * 
 * Central routing layer to select the correct persona (Student | Founder | Developer).
 */

import { parseStudentIntent } from './intent/studentIntentParser.js';
import { mapIntentToTasks as mapStudentTasks } from './intent/studentTaskMapper.js';
import { formatStudentOutput } from './formatters/studentFormatter.js';

import { parseFounderIntent } from './intent/founderIntentParser.js';
import { mapFounderIntentToTasks } from './mappers/founderTaskMapper.js';
import { formatFounderOutput } from './formatters/founderFormatter.js';

import { parseDeveloperIntent } from './intent/developerIntentParser.js';
import { mapDeveloperIntentToTasks } from './mappers/developerTaskMapper.js';
import { formatDeveloperOutput } from './formatters/developerFormatter.js';

import type { TaskNode } from '@nexus-os/types';

export type OSMode = 'student' | 'founder' | 'developer';

export interface RoutedIntent {
  intent: any;
  tasks: TaskNode[];
  formatter: (synthesis: any) => any;
}

export function routeIntent(input: string, mode: OSMode): RoutedIntent {
  console.log(`[IntentRouter] 🗺️ Routing mission via ${mode.toUpperCase()} mode.`);

  switch (mode) {
    case 'founder': {
      const intent = parseFounderIntent(input);
      const tasks = mapFounderIntentToTasks(intent);
      return { intent, tasks, formatter: formatFounderOutput };
    }

    case 'developer': {
      const intent = parseDeveloperIntent(input);
      const tasks = mapDeveloperIntentToTasks(intent);
      return { intent, tasks, formatter: formatDeveloperOutput };
    }

    case 'student':
    default: {
      const intent = parseStudentIntent(input);
      const tasks = mapStudentTasks(intent);
      return { intent, tasks, formatter: formatStudentOutput };
    }
  }
}
