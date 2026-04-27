export type DeveloperIntentType =
  | 'build_feature'
  | 'refactor_code'
  | 'debug_code'
  | 'design_system'
  | 'architecture_design'
  | 'unit_testing'
  | 'documentation';

export interface DeveloperIntent {
  type: DeveloperIntentType;
  language?: string;
  rawInput?: string;
}

export function parseDeveloperIntent(input: string): DeveloperIntent {
  const lower = input.toLowerCase();

  if (lower.includes('test')) return { type: 'unit_testing', rawInput: input };
  if (lower.includes('refactor')) return { type: 'refactor_code', rawInput: input };
  if (lower.includes('debug') || lower.includes('fix')) return { type: 'debug_code', rawInput: input };
  if (lower.includes('document')) return { type: 'documentation', rawInput: input };
  if (lower.includes('architecture')) return { type: 'architecture_design', rawInput: input };
  if (lower.includes('design system')) return { type: 'design_system', rawInput: input };

  return {
    type: 'build_feature',
    language: lower.includes('python') ? 'python' : lower.includes('rust') ? 'rust' : 'typescript',
    rawInput: input,
  };
}

