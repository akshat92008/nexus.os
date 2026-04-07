/**
 * Student Experience Layer — Task Mapper
 *
 * Converts a StudentIntent into a list of TaskNodes for the orchestrator.
 * This ensures that student missions are handled by the correct agents
 * with the right output schema.
 */

import type { TaskNode, AgentType } from '@nexus-os/types';
import type { StudentIntent } from './studentIntentParser.js';

export function mapIntentToTasks(intent: StudentIntent): TaskNode[] {
  const nodes: TaskNode[] = [];

  // 1. Initial Research Task (Root)
  nodes.push({
    id: 'student_research',
    label: `Research: ${intent.subject || 'Requested Topic'}`,
    agentType: 'researcher' as AgentType,
    dependencies: [],
    contextFields: [],
    priority: 'high',
    maxRetries: 2,
    expectedOutput: {
      format: 'prose',
      example: 'Detailed explanation of the topic with current facts.',
    },
    goalAlignment: 1.0,
  });

  // 2. Intent-Specific Secondary Task
  if (intent.type === 'explain_topic' || intent.type === 'summarize_notes') {
    nodes.push({
      id: 'student_analysis',
      label: 'Identify Key Concepts',
      agentType: 'analyst' as AgentType,
      dependencies: ['student_research'],
      contextFields: ['student_research'],
      priority: 'medium',
      maxRetries: 2,
      expectedOutput: {
        format: 'list',
        minItems: 5,
        example: '5-7 key concepts identified and explained clearly.',
      },
      goalAlignment: 0.9,
    });
  } else if (intent.type === 'exam_preparation') {
    nodes.push({
      id: 'student_qa_gen',
      label: 'Generate Mock Exam Questions',
      agentType: 'analyst' as AgentType,
      dependencies: ['student_research'],
      contextFields: ['student_research'],
      priority: 'high',
      maxRetries: 2,
      expectedOutput: {
        format: 'structured_json',
        fields: {
          questions: 'Array of {question: string, answer: string, marks: number}',
        },
        example: '3-5 challenging exam questions for the subject.',
      },
      goalAlignment: 1.0,
    });
  }

  // 3. Final Writing Task (Synthesis)
  nodes.push({
    id: 'student_writer_synthesis',
    label: 'Format Student Study Guide',
    agentType: 'writer' as AgentType,
    dependencies: nodes.map((n) => n.id),
    contextFields: nodes.map((n) => n.id),
    priority: 'critical',
    maxRetries: 2,
    expectedOutput: {
      format: 'structured_json',
      fields: {
        explanation: 'Detailed prose explanation',
        keyPoints: 'Array of strings',
        notes: 'Extended markdown notes',
        questions: 'Mock exam questions',
        quickRevision: 'Short, high-density summary',
      },
      example: 'A complete study guide ready for the student.',
    },
    goalAlignment: 1.0,
  });

  return nodes;
}
