/**
 * Nexus OS — Task Schema
 * Consistent JSON structure for durable task state.
 */

export const TASK_RECORD_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "TaskRecord",
  type: "object",
  properties: {
    taskId: { type: "string", description: "Unique ID of the task in the DAG" },
    missionId: { type: "string", description: "ID of the parent mission" },
    status: {
      type: "string",
      enum: ["pending", "locked", "running", "completed", "failed", "skipped"],
      description: "Current state of the task in the mission lifecycle"
    },
    attemptCount: { type: "integer", minimum: 0, description: "Number of times this task has been attempted" },
    lockedAt: { type: "number", description: "Unix timestamp (ms) when the task was locked for execution" },
    completedAt: { type: "number", description: "Unix timestamp (ms) when the task reached completion" },
    errorMessage: { type: "string", description: "Error details if the task failed" },
    outputKey: { type: "string", description: "Key pointing to the artifact in mission memory" }
  },
  required: ["taskId", "missionId", "status", "attemptCount"],
  additionalProperties: false
};
