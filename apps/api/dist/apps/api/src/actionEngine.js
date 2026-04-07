export function generateNextActions(workspace) {
    const actions = [];
    let actionIdCounter = 1;
    for (const section of workspace.sections) {
        if (section.type === 'tasklist') {
            const tasks = section.content;
            const pendingHigh = tasks.filter(t => t.status !== 'done' && t.priority === 'high');
            const pendingOther = tasks.filter(t => t.status !== 'done' && t.priority !== 'high');
            pendingHigh.forEach(task => {
                actions.push({
                    id: `act_${workspace.id}_${actionIdCounter++}`,
                    title: `Execute: ${task.title}`,
                    description: 'High priority task identified in your strategy roadmap.',
                    priority: 'high',
                    type: 'execute',
                    relatedSectionId: section.id,
                });
            });
            if (pendingOther.length > 0) {
                actions.push({
                    id: `act_${workspace.id}_${actionIdCounter++}`,
                    title: `Complete ${pendingOther.length} pending task(s)`,
                    description: 'Additional items remain in your strategic timeline.',
                    priority: 'medium',
                    type: 'execute',
                    relatedSectionId: section.id,
                });
            }
        }
        if (section.type === 'table') {
            const rows = section.content;
            if (rows.length > 0) {
                actions.push({
                    id: `act_${workspace.id}_${actionIdCounter++}`,
                    title: `Follow up with ${rows.length} leads`,
                    description: 'Initiate contact using the generated outreach templates.',
                    priority: 'high',
                    type: 'follow-up',
                    relatedSectionId: section.id,
                });
            }
        }
        if (section.type === 'insight') {
            actions.push({
                id: `act_${workspace.id}_${actionIdCounter++}`,
                title: `Review Executive Insights`,
                description: 'Analyze synthesized findings to shape your next strategic move.',
                priority: 'low',
                type: 'review',
                relatedSectionId: section.id,
            });
        }
    }
    // Sort: High -> Medium -> Low
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    actions.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
    // Cap to top 5 actions to keep it actionable
    return actions.slice(0, 5);
}
//# sourceMappingURL=actionEngine.js.map