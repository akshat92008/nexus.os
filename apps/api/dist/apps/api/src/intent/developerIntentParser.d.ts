/**
 * Developer Experience Layer — Intent Parser
 *
 * Categorizes raw user input into engineering-specific mission types.
 * Standardizes language, framework, and output format for coding goals.
 */
export type DeveloperIntentType = 'build_feature' | 'debug_code' | 'explain_code' | 'design_system' | 'refactor_code' | 'unit_testing' | 'architecture_design' | 'documentation';
export interface DeveloperIntent {
    type: DeveloperIntentType;
    language?: string;
    framework?: string;
    outputFormat: 'code' | 'explanation' | 'architecture';
}
export declare function parseDeveloperIntent(input: string): DeveloperIntent;
//# sourceMappingURL=developerIntentParser.d.ts.map