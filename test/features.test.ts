import { describe, expect, it } from "vitest";
import { deriveDataset } from "../src/domain/features";
import type { FplBootstrap, FplFixture, FplHistoryResponse } from "../src/domain/contracts";

describe("deriveDataset", () => {
  it("builds player features and fixture summaries from fixed inputs", () => {
    const bootstrap: FplBootstrap = {
      elements: [
        {
          id: 1,
          first_name: "A",
          second_name: "Keeper",
          web_name: "AKeeper",
          team: 1,
          element_type: 1,
          now_cost: 50,
          selected_by_percent: "12.4",
          chance_of_playing_next_round: 100,
          minutes: 270,
          points_per_game: "4.5",
          total_points: 20,
          form: "4.5",
          ict_index: "12.3",
          status: "a",
        },
      ],
      teams: [{ id: 1, name: "Arsenal", short_name: "ARS" }],
      events: [{ id: 30, finished: false, is_current: true, is_next: false, deadline_time: "2026-04-03T00:00:00Z" }],
      element_types: [{ id: 1, singular_name_short: "GKP" }],
    };

    const fixtures: FplFixture[] = [
      { id: 11, event: 30, team_a: 2, team_h: 1, team_a_difficulty: 4, team_h_difficulty: 2, finished: false },
      { id: 12, event: 31, team_a: 1, team_h: 3, team_a_difficulty: 3, team_h_difficulty: 2, finished: false },
      { id: 13, event: 32, team_a: 4, team_h: 1, team_a_difficulty: 4, team_h_difficulty: 2, finished: false },
    ];

    const histories = new Map<number, FplHistoryResponse>([
      [1, {
        history: [
          {
            element: 1,
            round: 27,
            opponent_team: 2,
            total_points: 6,
            minutes: 90,
            goals_scored: 0,
            assists: 0,
            clean_sheets: 1,
            goals_conceded: 0,
            bonus: 2,
            expected_goals: "0.00",
            expected_assists: "0.00",
            expected_goal_involvements: "0.00",
            expected_goals_conceded: "1.20",
            value: 50,
          },
          {
            element: 1,
            round: 28,
            opponent_team: 3,
            total_points: 2,
            minutes: 90,
            goals_scored: 0,
            assists: 0,
            clean_sheets: 0,
            goals_conceded: 1,
            bonus: 0,
            expected_goals: "0.00",
            expected_assists: "0.00",
            expected_goal_involvements: "0.00",
            expected_goals_conceded: "1.40",
            value: 50,
          },
          {
            element: 1,
            round: 29,
            opponent_team: 4,
            total_points: 7,
            minutes: 90,
            goals_scored: 0,
            assists: 0,
            clean_sheets: 1,
            goals_conceded: 0,
            bonus: 3,
            expected_goals: "0.00",
            expected_assists: "0.00",
            expected_goal_involvements: "0.00",
            expected_goals_conceded: "0.80",
            value: 50,
          },
        ],
        fixtures: [],
      }],
    ]);

    const dataset = deriveDataset(bootstrap, fixtures, histories);

    expect(dataset.currentGameweek).toBe(30);
    expect(dataset.players[0].total_points).toBe(20);
    expect(dataset.playerFeatures[0].clean_sheet_rate).toBeCloseTo(2 / 3);
    expect(dataset.fixtureDifficultySummary[0].fdr_avg_next_3gw).toBeCloseTo((2 + 3 + 2) / 3);
  });
});
