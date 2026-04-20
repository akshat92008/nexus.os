/**
 * Nexus OS — JSON Repair Utility
 * 
 * LLMs frequently wrap JSON in markdown blocks or fail to close brackets.
 * This utility attempts to sanitize and repair the string before parsing.
 */

export function repairJson(raw: string): any {
  let cleaned = raw.trim();

  // 1. Strip Markdown Code Blocks
  if (cleaned.includes('```json')) {
    cleaned = cleaned.split('```json')[1].split('```')[0].trim();
  } else if (cleaned.includes('```')) {
    cleaned = cleaned.split('```')[1].split('```')[0].trim();
  }

  // 2. Remove leading/trailing non-JSON noise
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let start = -1;
  let endChar = '';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    endChar = '}';
  } else if (firstBracket !== -1) {
    start = firstBracket;
    endChar = ']';
  }

  if (start !== -1) {
    const lastEnd = cleaned.lastIndexOf(endChar);
    if (lastEnd !== -1) {
      cleaned = cleaned.slice(start, lastEnd + 1);
    } else {
      cleaned = cleaned.slice(start);
    }
  }

  // 3. Simple Bracket Closure
  // If it starts with { but doesn't end with }
  if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
    cleaned += '}';
  }
  if (cleaned.startsWith('[') && !cleaned.endsWith(']')) {
    cleaned += ']';
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // 4. More aggressive cleanup: remove trailing commas before closing braces
    try {
      const fixed = cleaned
        .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":'); // quote unquoted keys
      return JSON.parse(fixed);
    } catch (finalErr) {
      console.error('[JSONRepair] Failed to repair JSON:', finalErr);
      throw new Error(`Failed to parse LLM output as JSON: ${cleaned.slice(0, 100)}...`);
    }
  }
}
