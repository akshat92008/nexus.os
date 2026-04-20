import { describe, it, expect } from 'vitest';
import {
  formatOutput,
  transformToWorkspace,
  formatStudentToWorkspace,
  formatFounderToWorkspace,
  formatDeveloperToWorkspace,
  formattedOutputToLegacyContent
} from '../outputFormatter.js';
import type { SynthesisArtifact, GoalType } from '@nexus-os/types';

describe('outputFormatter', () => {
  const mockSynthesis: SynthesisArtifact = {
    format: 'structured_json',
    agentType: 'chief_analyst',
    taskId: 'chief_analyst_synthesis',
    executiveSummary: 'Test summary',
    criteriaResults: [],
    keyInsights: [
      { insight: 'Insight 1', confidence: 'high', supportingAgents: [] }
    ],
    resolvedConflicts: [],
    deliverable: {
      leads: [{ name: 'Lead 1', company: 'Company 1' }],
      roadmap: [{ phase: 'Phase 1', actions: ['Action 1'], timeline: '1 week' }],
      risks: [{ risk: 'Risk 1', mitigation: 'Mitigation 1' }],
      quickWins: ['Win 1'],
      recommendations: ['Rec 1']
    },
    gaps: ['Gap 1'],
    nextSteps: [{ action: 'Step 1', timeframe: '1 day', priority: 'high' }]
  };

  describe('formatOutput', () => {
    it('should format lead_gen output correctly', () => {
      const result = formatOutput(mockSynthesis, 'lead_gen');
      expect(result.goalType).toBe('lead_gen');
      expect(result.data.executiveSummary).toBe('Test summary');
      expect(result.data.leads).toHaveLength(1);
      expect(result.data.leads[0].name).toBe('Lead 1');
      expect(result.data.keyInsights).toContain('Insight 1');
    });

    it('should format research output correctly', () => {
      const result = formatOutput(mockSynthesis, 'research');
      expect(result.goalType).toBe('research');
      expect(result.data.keyInsights[0]).toEqual({ insight: 'Insight 1', confidence: 'high' });
      expect(result.data.recommendations).toContain('Rec 1');
    });

    it('should format strategy output correctly', () => {
      const result = formatOutput(mockSynthesis, 'strategy');
      expect(result.goalType).toBe('strategy');
      expect(result.data.roadmap).toHaveLength(1);
      expect(result.data.risks).toHaveLength(1);
      expect(result.data.quickWins).toContain('Win 1');
    });

    it('should format general/analysis/content/code output correctly', () => {
      const result = formatOutput(mockSynthesis, 'analysis');
      expect(result.goalType).toBe('analysis');
      expect(result.data.keyInsights[0]).toEqual({ insight: 'Insight 1', confidence: 'high' });
      expect(result.data.deliverable).toBeDefined();
    });

    it('should fallback to generalRule for unknown goalType', () => {
      const result = formatOutput(mockSynthesis, 'unknown' as any);
      expect(result.goalType).toBe('unknown');
      expect(result.data.executiveSummary).toBe('Test summary');
    });

    it('should handle missing deliverable or optional fields', () => {
      const minimalSynthesis: SynthesisArtifact = {
        ...mockSynthesis,
        deliverable: undefined as any,
        keyInsights: undefined as any,
        gaps: undefined as any,
        nextSteps: undefined as any,
      };
      const result = formatOutput(minimalSynthesis, 'lead_gen');
      expect(result.data.leads).toEqual([]);
      expect(result.data.keyInsights).toEqual([]);
      expect(result.data.gaps).toEqual([]);
      expect(result.data.nextSteps).toEqual([]);
    });
  });

  describe('transformToWorkspace', () => {
    it('should create a valid workspace structure', () => {
      const workspace = transformToWorkspace(
        mockSynthesis,
        'Test Goal',
        'lead_gen',
        'mission-123',
        new Map()
      );

      expect(workspace.id).toBe('mission-123');
      expect(workspace.goal).toBe('Test Goal');
      expect(workspace.goalType).toBe('lead_gen');

      // Insights section
      const insightsSec = workspace.sections.find(s => s.id === 'sec_insights');
      expect(insightsSec).toBeDefined();
      expect(insightsSec?.content[0].insight).toBe('Insight 1');

      // Table section
      const tableSec = workspace.sections.find(s => s.id === 'sec_table');
      expect(tableSec).toBeDefined();
      expect(tableSec?.content).toHaveLength(1);
      expect(tableSec?.content[0].name).toBe('Lead 1');

      // Tasklist section
      const tasksSec = workspace.sections.find(s => s.id === 'sec_tasks');
      expect(tasksSec).toBeDefined();
      expect(tasksSec?.content.length).toBeGreaterThan(0);
    });

    it('should handle document section if deliverable has body/code/etc', () => {
      const synthesisWithDoc: SynthesisArtifact = {
        ...mockSynthesis,
        deliverable: { body: 'Final content' }
      };
      const workspace = transformToWorkspace(
        synthesisWithDoc,
        'Goal',
        'content',
        'm1',
        new Map()
      );
      const docSec = workspace.sections.find(s => s.id === 'sec_doc');
      expect(docSec).toBeDefined();
      expect(docSec?.content).toBe('Final content');
    });

    it('should provide default values when synthesis is empty', () => {
        const emptySynthesis: any = {};
        const workspace = transformToWorkspace(emptySynthesis, 'Goal', 'general', 'm1', new Map());

        const insightsSec = workspace.sections.find(s => s.id === 'sec_insights');
        expect(insightsSec?.content[0].insight).toBe('Synthesis complete.');

        const tasksSec = workspace.sections.find(s => s.id === 'sec_tasks');
        expect(tasksSec?.content[0].title).toBe('Review output');
    });
  });

  describe('Specialized formatters', () => {
    it('formatStudentToWorkspace should map correctly', () => {
      const data = { explanation: 'Exp', keyPoints: ['P1'], notes: 'Notes' };
      const workspace = formatStudentToWorkspace(data, 'Goal', 'id');
      expect(workspace.sections[0].description).toBe('Exp');
      expect(workspace.sections[0].content[0].insight).toBe('P1');
    });

    it('formatFounderToWorkspace should map correctly', () => {
      const data = { executiveSummary: 'Sum', keyInsights: ['I1'], actionPlan: ['A1'] };
      const workspace = formatFounderToWorkspace(data, 'Goal', 'id');
      expect(workspace.sections[0].description).toBe('Sum');
      expect(workspace.sections[0].content[0].insight).toBe('I1');
    });

    it('formatDeveloperToWorkspace should map correctly', () => {
      const data = { explanation: 'Exp', improvements: ['Imp'], steps: ['S1'], code: 'code' };
      const workspace = formatDeveloperToWorkspace(data, 'Goal', 'id');
      expect(workspace.sections[0].description).toBe('Exp');
      expect(workspace.sections[3].content).toBe('code');
    });
  });

  describe('formattedOutputToLegacyContent', () => {
    it('should stringify output data', () => {
      const output = formatOutput(mockSynthesis, 'general');
      const content = formattedOutputToLegacyContent(output);
      const parsed = JSON.parse(content);
      expect(parsed.executiveSummary).toBe('Test summary');
    });
  });
});
