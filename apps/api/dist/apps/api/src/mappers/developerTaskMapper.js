/**
 * Developer Experience Layer — Task Mapper
 *
 * Converts a DeveloperIntent into a list of TaskNodes for the orchestrator.
 * This ensures that coding missions are handled by agents with
 * production-level standards.
 */
export function mapDeveloperIntentToTasks(intent) {
    const nodes = [];
    // 1. Initial Analysis/Architecture Task (Root)
    nodes.push({
        id: 'developer_analysis',
        label: `Analyze: ${intent.type}`,
        agentType: 'analyst',
        dependencies: [],
        contextFields: [],
        priority: 'high',
        maxRetries: 2,
        expectedOutput: {
            format: 'prose',
            example: 'Technical specification for implementation.',
        },
        goalAlignment: 1.0,
    });
    // 2. Intent-Specific Coding Task
    if (intent.type === 'build_feature' || intent.type === 'refactor_code' || intent.type === 'debug_code') {
        nodes.push({
            id: 'developer_coder_impl',
            label: `Implement: ${intent.language || 'Code'}`,
            agentType: 'coder',
            dependencies: ['developer_analysis'],
            contextFields: ['developer_analysis'],
            priority: 'high',
            maxRetries: 3,
            expectedOutput: {
                format: 'prose', // Prototyping: final formatted code as prose for simplicity
                fields: {
                    code: 'Production-ready code block',
                    explanation: 'Step-by-step notes',
                },
                example: 'Clean code with documentation.',
            },
            goalAlignment: 1.0,
        });
        nodes.push({
            id: 'developer_review',
            label: 'Security & Quality Review',
            agentType: 'analyst',
            dependencies: ['developer_coder_impl'],
            contextFields: ['developer_coder_impl'],
            priority: 'medium',
            maxRetries: 2,
            goalAlignment: 0.9,
            expectedOutput: {
                format: 'list',
                example: '3-5 improvements or security observations.',
            },
        });
        nodes.push({
            id: 'developer_test_generator',
            label: `Generate Tests: ${intent.language || 'Code'}`,
            agentType: 'coder',
            dependencies: ['developer_coder_impl'],
            contextFields: ['developer_coder_impl', 'developer_analysis'],
            priority: 'medium',
            maxRetries: 2,
            goalAlignment: 1.0,
            expectedOutput: {
                format: 'prose',
                example: 'Unit tests for the implemented feature.',
            },
        });
    }
    else if (intent.type === 'design_system' || intent.type === 'architecture_design') {
        nodes.push({
            id: 'developer_arch_blueprint',
            label: 'System Blueprint',
            agentType: 'strategist',
            dependencies: ['developer_analysis'],
            contextFields: ['developer_analysis'],
            priority: 'critical',
            maxRetries: 2,
            goalAlignment: 1.0,
            expectedOutput: {
                format: 'prose',
                example: 'High-level architectural diagram (Mermaid) and component breakdown.',
            },
        });
        nodes.push({
            id: 'developer_data_model',
            label: 'Data Schema Design',
            agentType: 'coder',
            dependencies: ['developer_arch_blueprint'],
            contextFields: ['developer_arch_blueprint'],
            priority: 'high',
            maxRetries: 2,
            goalAlignment: 1.0,
            expectedOutput: {
                format: 'code',
                example: 'SQL schema or Prisma models.',
            },
        });
    }
    else if (intent.type === 'unit_testing') {
        nodes.push({
            id: 'developer_test_suite',
            label: 'Comprehensive Test Suite',
            agentType: 'coder',
            dependencies: ['developer_analysis'],
            contextFields: ['developer_analysis'],
            priority: 'high',
            maxRetries: 2,
            goalAlignment: 1.0,
            expectedOutput: { format: 'code', example: 'Vitest/Jest test file.' }
        });
    }
    else if (intent.type === 'documentation') {
        nodes.push({
            id: 'developer_readme_gen',
            label: 'README & API Docs',
            agentType: 'writer',
            dependencies: ['developer_analysis'],
            contextFields: ['developer_analysis'],
            priority: 'high',
            maxRetries: 2,
            goalAlignment: 1.0,
            expectedOutput: { format: 'prose', example: 'Professional documentation with examples.' }
        });
    }
    // 3. Final Synthesis (Synthesis/Writer Task)
    nodes.push({
        id: 'developer_final_output',
        label: 'Assemble Engineering Output',
        agentType: 'writer',
        dependencies: nodes.map((n) => n.id),
        contextFields: nodes.map((n) => n.id),
        priority: 'critical',
        maxRetries: 2,
        expectedOutput: {
            format: 'structured_json',
            fields: {
                explanation: 'Detailed technical guide',
                code: 'Full implementation block',
                steps: 'Array of setup/implementation steps',
                improvements: 'Analysis and review suggestions',
            },
            example: 'Code-ready output for the developer.',
        },
        goalAlignment: 1.0,
    });
    return nodes;
}
//# sourceMappingURL=developerTaskMapper.js.map