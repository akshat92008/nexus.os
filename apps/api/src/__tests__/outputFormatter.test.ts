import { describe, it, expect } from 'vitest';
import { formatStudentToWorkspace } from '../outputFormatter.js';

describe('outputFormatter — formatStudentToWorkspace', () => {
  it('correctly formats student data into a Workspace', () => {
    const data = {
      explanation: 'Test explanation',
      keyPoints: ['Point 1', 'Point 2'],
      notes: 'Test notes',
      extra: 'extra info'
    };
    const goal = 'Learn about testing';
    const id = 'mission_123';

    const result = formatStudentToWorkspace(data, goal, id);

    expect(result.id).toBe(id);
    expect(result.goal).toBe(goal);
    expect(result.goalType).toBe('research');

    // Check Insights section
    const insightsSection = result.sections.find(s => s.id === 'sec_insights');
    expect(insightsSection).toBeDefined();
    expect(insightsSection?.title).toBe('Executive Insights');
    expect(insightsSection?.description).toBe('Test explanation');
    expect(insightsSection?.content).toEqual([
      { insight: 'Point 1', confidence: 'high' },
      { insight: 'Point 2', confidence: 'high' }
    ]);

    // Check Tasks section (default since no nextSteps/roadmap provided)
    const tasksSection = result.sections.find(s => s.id === 'sec_tasks');
    expect(tasksSection).toBeDefined();
    expect(tasksSection?.content).toEqual([{ id: 't1', title: 'Review output', status: 'pending', priority: 'high' }]);

    // Check Document section
    const docSection = result.sections.find(s => s.id === 'sec_doc');
    expect(docSection).toBeDefined();
    expect(docSection?.content).toBe('Test notes');
  });

  it('handles empty or missing data fields gracefully', () => {
    const data = {};
    const goal = 'Minimal goal';
    const id = 'mission_456';

    const result = formatStudentToWorkspace(data, goal, id);

    expect(result.id).toBe(id);

    const insightsSection = result.sections.find(s => s.id === 'sec_insights');
    expect(insightsSection?.description).toBe('Strategizing next steps...');
    expect(insightsSection?.content).toEqual([{ insight: 'Synthesis complete.', confidence: 'high' }]);

    // No document section should be created if notes is missing
    const docSection = result.sections.find(s => s.id === 'sec_doc');
    expect(docSection).toBeUndefined();
  });

  it('handles non-array keyPoints gracefully', () => {
    const data = {
      keyPoints: 'Single point'
    } as any;
    const goal = 'Test goal';
    const id = 'mission_789';

    const result = formatStudentToWorkspace(data, goal, id);

    const insightsSection = result.sections.find(s => s.id === 'sec_insights');
    expect(insightsSection?.content).toEqual([
      { insight: 'Single point', confidence: 'high' }
    ]);
  });
});
