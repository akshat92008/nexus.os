/**
 * Nexus OS — Memory Schema
 * Defines how agent outputs are stored and metadata-tagged in the Vault.
 */

export const MEMORY_ENTRY_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "MemoryEntry",
  type: "object",
  properties: {
    key: { type: "string", description: "Internal storage key (e.g. artifact:task_id)" },
    taskId: { type: "string", description: "ID of the task that produced this artifact" },
    agentType: {
      type: "string",
      enum: ["researcher", "analyst", "writer", "coder", "strategist", "summarizer", "chief_analyst"],
      description: "Type of agent that wrote this entry"
    },
    data: {
      type: "object",
      description: "The TypedArtifact data (Research, Analysis, Strategy, etc.)"
    },
    writtenAt: { type: "number", description: "Unix timestamp (ms) of the write operation" },
    tokensUsed: { type: "integer", minimum: 0, description: "Total tokens consumed to produce this artifact" },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "Semantic tags for vector and keyword search"
    },
    semanticHash: { type: "string", description: "Hash of the content for deduplication/integrity check" }
  },
  required: ["key", "taskId", "agentType", "data", "writtenAt", "tokensUsed"],
  additionalProperties: false
};
