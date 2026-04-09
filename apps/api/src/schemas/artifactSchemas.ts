/**
 * Nexus OS — Artifact Schemas
 * Core JSON Schemas for the Agent output engine.
 */

export const ARTIFACT_SCHEMAS = {
  RESEARCH: {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "ResearchArtifact",
    type: "object",
    properties: {
      format: { const: "structured_json" },
      agentType: { const: "researcher" },
      taskId: { type: "string" },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            insight: { type: "string" },
            confidence: { enum: ["high", "medium", "low"] },
            source: { type: "string" }
          },
          required: ["insight", "confidence"]
        }
      },
      keyEntities: { type: "array", items: { type: "string" } },
      marketSize: { type: "string" },
      painPoints: { type: "array", items: { type: "string" } }
    },
    required: ["format", "agentType", "taskId", "findings", "keyEntities"]
  },

  ANALYSIS: {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "AnalysisArtifact",
    type: "object",
    properties: {
      format: { const: "structured_json" },
      agentType: { const: "analyst" },
      taskId: { type: "string" },
      swot: {
        type: "object",
        properties: {
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" } },
          opportunities: { type: "array", items: { type: "string" } },
          threats: { type: "array", items: { type: "string" } }
        },
        required: ["strengths", "weaknesses", "opportunities", "threats"]
      },
      recommendations: { type: "array", items: { type: "string" } },
      riskLevel: { enum: ["low", "medium", "high"] }
    },
    required: ["format", "agentType", "taskId", "swot", "recommendations"]
  },

  STRATEGY: {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "StrategyArtifact",
    type: "object",
    properties: {
      format: { const: "structured_json" },
      agentType: { const: "strategist" },
      taskId: { type: "string" },
      executiveSummary: { type: "string" },
      roadmap: {
        type: "array",
        items: {
          type: "object",
          properties: {
            phase: { type: "string" },
            actions: { type: "array", items: { type: "string" } },
            timeline: { type: "string" }
          },
          required: ["phase", "actions", "timeline"]
        }
      },
      risks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            risk: { type: "string" },
            mitigation: { type: "string" }
          },
          required: ["risk", "mitigation"]
        }
      }
    },
    required: ["format", "agentType", "taskId", "executiveSummary", "roadmap"]
  }
};
