/**
 * Developer Experience Layer — Intent Parser
 *
 * Categorizes raw user input into engineering-specific mission types.
 * Standardizes language, framework, and output format for coding goals.
 */

export type DeveloperIntentType =
  | 'build_feature'
  | 'debug_code'
  | 'explain_code'
  | 'design_system'
  | 'refactor_code'
  | 'unit_testing'
  | 'architecture_design'
  | 'documentation';

export interface DeveloperIntent {
  type: DeveloperIntentType;
  language?: string;
  framework?: string;
  outputFormat: 'code' | 'explanation' | 'architecture';
}

export function parseDeveloperIntent(input: string): DeveloperIntent {
  const lower = input.toLowerCase();

  // 1. Determine Intent Type
  let type: DeveloperIntentType = 'build_feature';

  if (lower.includes('debug') || lower.includes('fix') || lower.includes('error') || lower.includes('broken')) {
    type = 'debug_code';
  } else if (lower.includes('explain') || lower.includes('how does') || lower.includes('understand')) {
    type = 'explain_code';
  } else if (lower.includes('design') || lower.includes('architecture') || lower.includes('system') || lower.includes('blueprint')) {
    type = 'design_system';
  } else if (lower.includes('refactor') || lower.includes('clean') || lower.includes('optimize') || lower.includes('improve')) {
    type = 'refactor_code';
  } else if (lower.includes('test') || lower.includes('spec') || lower.includes('unit') || lower.includes('jest') || lower.includes('vitest')) {
    type = 'unit_testing';
  } else if (lower.includes('architecture') || lower.includes('system') || lower.includes('design') || lower.includes('diagram')) {
    type = 'architecture_design';
  } else if (lower.includes('doc') || lower.includes('readme') || lower.includes('guide') || lower.includes('tutorial')) {
    type = 'documentation';
  }

  // 2. Extract Language/Framework (Simplified)
  let language = 'typescript';
  if (lower.includes('python')) language = 'python';
  else if (lower.includes('rust')) language = 'rust';
  else if (lower.includes('go')) language = 'go';
  else if (lower.includes('java')) language = 'java';

  let framework = '';
  if (lower.includes('react')) framework = 'react';
  else if (lower.includes('next') || lower.includes('nextjs')) framework = 'nextjs';
  else if (lower.includes('express')) framework = 'express';
  else if (lower.includes('tailwind')) framework = 'tailwind';

  // 3. Default Output Format per Intent
  let outputFormat: 'code' | 'explanation' | 'architecture' = 'code';
  if (type === 'explain_code') outputFormat = 'explanation';
  if (type === 'design_system') outputFormat = 'architecture';

  return { type, language, framework, outputFormat };
}
