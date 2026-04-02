import { describe, expect, it } from "vitest";
import { buildSquadArtifact } from "../src/domain/squadOptimizer";
import type { RankingArtifact } from "../src/domain/contracts";
import { validPreferences, validProfile } from "./fixtures/referenceInputs";

function entry(playerId: number, name: string, teamId: number, teamName: string, position: "GKP" | "DEF" | "MID" | "FWD", price: number, score: number, rankWithinPosition: number) {
  return {
    playerId,
    name,
    teamId,
    teamName,
    position,
    price,
    score,
    rankWithinPosition,
    shortlisted: true,
    components: { fixture: 0, expected_stats: 0, upside: 0, form: 0, value: 0, ownership: 0 },
    penalties: { rotation: 0, availability: 0 },
    signals: [],
  };
}

describe("buildSquadArtifact", () => {
  it("returns a legal 15-man squad", () => {
    const rankings: RankingArtifact = {
      agent: "player_ranking",
      profileId: "test_001",
      datasetVersion: "latest",
      generatedAt: new Date().toISOString(),
      filtersApplied: { bannedPlayers: [], avoidedTeams: [], lockedPlayers: [] },
      eligibility: {
        seasonPhase: "established",
        currentGameweek: 30,
        thresholds: { minGames: 3, minMinutes: 180 },
        excludedCounts: { banned: 0, avoidedTeam: 0, insufficientSample: 0, unavailable: 0 },
      },
      rankings: { GKP: [], DEF: [], MID: [], FWD: [] },
      shortlists: {
        GKP: [entry(1, "G1", 1, "ARS", "GKP", 5, 5, 1), entry(2, "G2", 2, "BHA", "GKP", 4.5, 4.7, 2)],
        DEF: [entry(3, "D1", 1, "ARS", "DEF", 5.5, 6, 1), entry(4, "D2", 2, "BHA", "DEF", 5, 5.7, 2), entry(5, "D3", 3, "CHE", "DEF", 4.5, 5.3, 3), entry(6, "D4", 4, "EVE", "DEF", 4.5, 5.1, 4), entry(7, "D5", 5, "FUL", "DEF", 4, 4.8, 5)],
        MID: [entry(8, "M1", 6, "LIV", "MID", 10, 9, 1), entry(9, "M2", 7, "MCI", "MID", 8.5, 8.1, 2), entry(10, "M3", 3, "CHE", "MID", 7.5, 7.6, 3), entry(11, "M4", 4, "EVE", "MID", 6.5, 6.8, 4), entry(12, "M5", 5, "FUL", "MID", 5.5, 5.9, 5)],
        FWD: [entry(13, "F1", 6, "LIV", "FWD", 9, 8.8, 1), entry(14, "F2", 7, "MCI", "FWD", 7.5, 7.2, 2), entry(15, "F3", 3, "CHE", "FWD", 6.5, 6.4, 3)],
      },
    };

    const artifact = buildSquadArtifact(validProfile, validPreferences, rankings);

    expect(artifact.squad).toHaveLength(15);
    expect(artifact.constraintViolations).toHaveLength(0);
    expect(artifact.totalCost).toBeLessThanOrEqual(100);
  });
});
