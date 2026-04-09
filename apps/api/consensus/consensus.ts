/**
 * Nexus OS — Consensus module
 *
 * Lightweight opinion aggregation for mission-level decisions.
 * This file is intentionally simple so it can be wired in later
 * without introducing paid or external dependencies.
 */

export interface ConsensusOpinion {
  sourceId: string;
  confidence: number;
  recommendation: string;
  rationale?: string;
}

export interface ConsensusResult {
  winner: ConsensusOpinion | null;
  score: number;
  summary: string;
  opinions: ConsensusOpinion[];
}

export function aggregateConsensus(opinions: ConsensusOpinion[]): ConsensusResult {
  if (opinions.length === 0) {
    return {
      winner: null,
      score: 0,
      summary: 'No consensus opinions were provided.',
      opinions: [],
    };
  }

  const sorted = [...opinions].sort((a, b) => b.confidence - a.confidence);
  const winner = sorted[0];
  const average = opinions.reduce((sum, item) => sum + item.confidence, 0) / opinions.length;

  return {
    winner,
    score: Number(average.toFixed(2)),
    summary: `Consensus reached with ${opinions.length} opinions. Highest confidence recommendation: ${winner.recommendation}`,
    opinions,
  };
}

export function mergeRecommendations(opinions: ConsensusOpinion[]): string {
  const unique = Array.from(new Map(opinions.map((item) => [item.recommendation, item])).values());
  return unique.map((item, index) => `${index + 1}. ${item.recommendation}`).join('\n');
}
