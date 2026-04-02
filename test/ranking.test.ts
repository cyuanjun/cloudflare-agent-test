import { describe, expect, it } from "vitest";
import { buildRankingArtifact } from "../src/domain/ranking";
import type { FixtureDifficultySummary, Player, PlayerFeatures } from "../src/domain/contracts";
import { validPreferences, validProfile } from "./fixtures/referenceInputs";

describe("buildRankingArtifact", () => {
  it("produces stable position rankings on a canned dataset", () => {
    const players: Player[] = [
      { id: 10, first_name: "Elite", second_name: "Mid", web_name: "EliteMid", team_id: 1, team_name: "ARS", element_type: 3, position: "MID", now_cost: 10, selected_by_percent: 35, chance_of_playing_next_round: 100, total_points: 180, form: "7.8", ict_index: "210.1", status: "a" },
      { id: 11, first_name: "Value", second_name: "Mid", web_name: "ValueMid", team_id: 2, team_name: "BHA", element_type: 3, position: "MID", now_cost: 6.5, selected_by_percent: 8, chance_of_playing_next_round: 100, total_points: 120, form: "5.5", ict_index: "150.0", status: "a" },
      { id: 12, first_name: "Solid", second_name: "Def", web_name: "SolidDef", team_id: 1, team_name: "ARS", element_type: 2, position: "DEF", now_cost: 5.5, selected_by_percent: 18, chance_of_playing_next_round: 100, total_points: 130, form: "5.0", ict_index: "121.4", status: "a" },
    ];

    const features: PlayerFeatures[] = [
      { player_id: 10, team_id: 1, position: "MID", rolling_avg_5gw: 7, form_3gw: 8, xG_per90: 0.7, xA_per90: 0.3, xGI_per90: 1, xGC_per90: 0.8, starts_rate: 0.95, minutes_per_game: 87, season_minutes: 1400, points_per_90: 8, clean_sheet_rate: 0.4, bonus_rate: 0.5, availability_risk: 0.02, ownership_percentile: 95, price: 10 },
      { player_id: 11, team_id: 2, position: "MID", rolling_avg_5gw: 5, form_3gw: 5.5, xG_per90: 0.32, xA_per90: 0.28, xGI_per90: 0.6, xGC_per90: 1.1, starts_rate: 0.9, minutes_per_game: 82, season_minutes: 1200, points_per_90: 5.5, clean_sheet_rate: 0.25, bonus_rate: 0.2, availability_risk: 0.04, ownership_percentile: 40, price: 6.5 },
      { player_id: 12, team_id: 1, position: "DEF", rolling_avg_5gw: 5, form_3gw: 5, xG_per90: 0.08, xA_per90: 0.1, xGI_per90: 0.18, xGC_per90: 0.75, starts_rate: 0.96, minutes_per_game: 89, season_minutes: 1450, points_per_90: 5.8, clean_sheet_rate: 0.48, bonus_rate: 0.22, availability_risk: 0.03, ownership_percentile: 70, price: 5.5 },
    ];

    const fixtures: FixtureDifficultySummary[] = [
      { team_id: 1, fdr_next_1gw: 2, fdr_avg_next_3gw: 2.2, fdr_avg_next_6gw: 2.5, fdr_avg_next_8gw: 2.8, dgw_gameweeks: [], bgw_gameweeks: [] },
      { team_id: 2, fdr_next_1gw: 3, fdr_avg_next_3gw: 3.1, fdr_avg_next_6gw: 3.4, fdr_avg_next_8gw: 3.3, dgw_gameweeks: [], bgw_gameweeks: [] },
    ];

    const artifact = buildRankingArtifact(validProfile, validPreferences, players, features, fixtures, "2026-04-02T00:00:00.000Z", 30);

    expect(artifact.rankings.MID[0].playerId).toBe(10);
    expect(artifact.rankings.DEF[0].playerId).toBe(12);
  });
});
