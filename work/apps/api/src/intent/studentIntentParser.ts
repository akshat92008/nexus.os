/**
 * Student Experience Layer — Intent Parser
 *
 * Categorizes raw user input into student-specific mission types.
 * Standardizes depth and format requirements for academic goals.
 */

export type StudentIntentType =
  | 'explain_topic'
  | 'finish_assignment'
  | 'exam_preparation'
  | 'summarize_notes'
  | 'project_help';

export interface StudentIntent {
  type: StudentIntentType;
  subject?: string;
  depth: 'low' | 'medium' | 'high';
  outputFormat: 'notes' | 'qa' | 'summary';
}

export function parseStudentIntent(input: string): StudentIntent {
  const lower = input.toLowerCase();

  // 1. Determine Intent Type
  let type: StudentIntentType = 'explain_topic';

  if (lower.includes('assignment') || lower.includes('homework') || lower.includes('essay')) {
    type = 'finish_assignment';
  } else if (lower.includes('exam') || lower.includes('test') || lower.includes('preparation') || lower.includes('study for')) {
    type = 'exam_preparation';
  } else if (lower.includes('summarize') || lower.includes('tldr') || lower.includes('notes')) {
    type = 'summarize_notes';
  } else if (lower.includes('project') || lower.includes('build') || lower.includes('prototype')) {
    type = 'project_help';
  }

  // 2. Extract Subject (Simplified Keyword Extraction)
  let subject = '';
  const match = lower.match(/(?:about|on|of|explain|topic)\s+([^?.!,]+)/i);
  if (match) {
    subject = match[1].trim();
  } else {
    // Fallback: take the last 2-3 words of the input as subject if long, or entire input if short
    const words = input.split(' ');
    subject = words.slice(-3).join(' ');
  }

  // 3. Determine Depth
  let depth: 'low' | 'medium' | 'high' = 'medium';
  if (lower.includes('deeply') || lower.includes('detailed') || lower.includes('mastery')) {
    depth = 'high';
  } else if (lower.includes('simple') || lower.includes('10 year old') || lower.includes('quick')) {
    depth = 'low';
  }

  // 4. Default Output Format per Intent
  let outputFormat: 'notes' | 'qa' | 'summary' = 'notes';
  if (type === 'exam_preparation') outputFormat = 'qa';
  if (type === 'summarize_notes') outputFormat = 'summary';

  return { type, subject, depth, outputFormat };
}
