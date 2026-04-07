/**
 * Founder Experience Layer — Task Mapper
 *
 * Converts a FounderIntent into a list of TaskNodes for the orchestrator.
 * This ensures that business missions are handled by agents with
 * a startup/operator mindset.
 */
export function mapFounderIntentToTasks(intent) {
    const nodes = [];
    // 1. Initial Market Research Task (Root)
    nodes.push({
        id: 'founder_market_research',
        label: `Market Analysis: ${intent.niche || 'Business Goal'}`,
        agentType: 'researcher',
        dependencies: [],
        contextFields: [],
        priority: 'high',
        maxRetries: 2,
        expectedOutput: {
            format: 'prose',
            example: 'Detailed market summary with niche-specific insights.',
        },
        goalAlignment: 1.0,
    });
    // 2. Intent-Specific Secondary Tasks
    if (intent.type === 'lead_generation') {
        nodes.push({
            id: 'founder_lead_enrichment',
            label: 'Identify Prospect Profiles',
            agentType: 'analyst',
            dependencies: ['founder_market_research'],
            contextFields: ['founder_market_research'],
            priority: 'high',
            maxRetries: 2,
            expectedOutput: {
                format: 'list',
                minItems: 5,
                example: '5-10 specific target companies or profiles.',
            },
            goalAlignment: 1.0,
        });
        nodes.push({
            id: 'founder_lead_scraper',
            label: 'Enrich Lead Data',
            agentType: 'coder',
            dependencies: ['founder_lead_enrichment'],
            contextFields: ['founder_lead_enrichment', 'founder_market_research'],
            priority: 'medium',
            maxRetries: 3,
            expectedOutput: {
                format: 'structured_json',
                fields: {
                    leads: 'Array of { company, role, painPoint, outreachHook }',
                },
                example: 'Verified lead list with personalized hooks.',
            },
            goalAlignment: 0.9,
        });
    }
    else if (intent.type === 'market_research' || intent.type === 'swot_analysis') {
        nodes.push({
            id: 'founder_competitor_teardown',
            label: 'Competitive Intelligence',
            agentType: 'analyst',
            dependencies: ['founder_market_research'],
            contextFields: ['founder_market_research'],
            priority: 'high',
            maxRetries: 2,
            expectedOutput: {
                format: 'structured_json',
                fields: {
                    competitors: 'Array of { name, strength, weakness, gap }',
                },
                example: 'Competitive landscape analysis.',
            },
            goalAlignment: 1.0,
        });
        nodes.push({
            id: 'founder_swot_matrix',
            label: 'SWOT Analysis Matrix',
            agentType: 'analyst',
            dependencies: ['founder_competitor_teardown'],
            contextFields: ['founder_market_research', 'founder_competitor_teardown'],
            priority: 'high',
            maxRetries: 2,
            expectedOutput: {
                format: 'structured_json',
                fields: {
                    strengths: 'Array of strings',
                    weaknesses: 'Array of strings',
                    opportunities: 'Array of strings',
                    threats: 'Array of strings',
                },
                example: 'A complete SWOT grid.',
            },
            goalAlignment: 1.0,
        });
        nodes.push({
            id: 'founder_strategic_positioning',
            label: 'Strategic Roadmap',
            agentType: 'strategist',
            dependencies: ['founder_swot_matrix'],
            contextFields: ['founder_market_research', 'founder_swot_matrix'],
            priority: 'critical',
            maxRetries: 2,
            expectedOutput: {
                format: 'prose',
                example: '3-phase execution roadmap for market entry.',
            },
            goalAlignment: 1.0,
        });
    }
    else if (intent.type === 'product_strategy') {
        nodes.push({
            id: 'founder_user_personas',
            label: 'User Persona Mapping',
            agentType: 'analyst',
            dependencies: ['founder_market_research'],
            contextFields: ['founder_market_research'],
            priority: 'high',
            maxRetries: 2,
            goalAlignment: 1.0,
            expectedOutput: { format: 'list', example: 'Primary and secondary user profiles.' }
        });
        nodes.push({
            id: 'founder_feature_roadmap',
            label: 'MVP Feature Set',
            agentType: 'strategist',
            dependencies: ['founder_user_personas'],
            contextFields: ['founder_user_personas', 'founder_market_research'],
            priority: 'critical',
            maxRetries: 2,
            goalAlignment: 1.0,
            expectedOutput: { format: 'list', example: 'Prioritized list of features for v1.' }
        });
    }
    // 3. Final Synthesis (Synthesis/Writer Task)
    nodes.push({
        id: 'founder_writer_synthesis',
        label: 'Executive Summary & Plan',
        agentType: 'writer',
        dependencies: nodes.map((n) => n.id),
        contextFields: nodes.map((n) => n.id),
        priority: 'critical',
        maxRetries: 2,
        expectedOutput: {
            format: 'structured_json',
            fields: {
                executiveSummary: 'Brief, high-impact business summary',
                keyInsights: 'Array of findings',
                opportunities: 'High-growth gaps identified',
                risks: 'Strategic hurdles',
                actionPlan: 'Step-by-step next actions',
            },
            example: 'A boardroom-ready report for the founder.',
        },
        goalAlignment: 1.0,
    });
    return nodes;
}
//# sourceMappingURL=founderTaskMapper.js.map