import type {
  FixtureDifficultySummary,
  FplBootstrap,
  FplFixture,
  FplHistoryEntry,
  FplHistoryResponse,
  Player,
  PlayerFeatures,
  SharedDataset,
} from "./contracts";
import { average, clamp, percentile, positionFromElementType, sum } from "./utils";

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number.parseFloat(value);
}

function sortHistory(entries: FplHistoryEntry[]): FplHistoryEntry[] {
  return [...entries].sort((left, right) => left.round - right.round);
}

function getRecent(entries: FplHistoryEntry[], count: number): FplHistoryEntry[] {
  return entries.slice(Math.max(0, entries.length - count));
}

function per90(total: number, minutes: number): number {
  if (minutes <= 0) {
    return 0;
  }
  return (total / minutes) * 90;
}

function deriveAvailabilityRisk(chanceOfPlayingNextRound: number | null, startsRate: number): number {
  const chancePenalty = chanceOfPlayingNextRound == null ? 0.15 : 1 - clamp(chanceOfPlayingNextRound / 100);
  const startsPenalty = (1 - startsRate) * 0.5;
  return clamp(chancePenalty + startsPenalty, 0, 1);
}

function summarizeUpcomingFixtures(teamId: number, fixtures: FplFixture[], currentGameweek: number | null): FixtureDifficultySummary {
  const futureFixtures = fixtures
    .filter((fixture) => fixture.event !== null)
    .filter((fixture) => fixture.team_h === teamId || fixture.team_a === teamId)
    .filter((fixture) => currentGameweek == null || (fixture.event as number) >= currentGameweek)
    .sort((left, right) => (left.event as number) - (right.event as number));

  const difficulties = futureFixtures.map((fixture) => (
    fixture.team_h === teamId ? fixture.team_h_difficulty : fixture.team_a_difficulty
  ));

  const gameweekCounts = new Map<number, number>();
  for (const fixture of futureFixtures) {
    const event = fixture.event as number;
    gameweekCounts.set(event, (gameweekCounts.get(event) ?? 0) + 1);
  }

  const windows = (count: number): number | null => {
    const slice = difficulties.slice(0, count);
    return slice.length === 0 ? null : average(slice);
  };

  return {
    team_id: teamId,
    fdr_next_1gw: difficulties[0] ?? null,
    fdr_avg_next_3gw: windows(3),
    fdr_avg_next_6gw: windows(6),
    fdr_avg_next_8gw: windows(8),
    dgw_gameweeks: [...gameweekCounts.entries()].filter(([, count]) => count > 1).map(([event]) => event),
    bgw_gameweeks: currentGameweek == null
      ? []
      : Array.from({ length: 8 }, (_, index) => currentGameweek + index).filter((event) => !gameweekCounts.has(event)),
  };
}

function derivePlayer(player: FplBootstrap["elements"][number], bootstrap: FplBootstrap): Player {
  const team = bootstrap.teams.find((entry) => entry.id === player.team);
  if (!team) {
    throw new Error(`Missing team metadata for player ${player.id}.`);
  }

  return {
    id: player.id,
    first_name: player.first_name,
    second_name: player.second_name,
    web_name: player.web_name,
    team_id: player.team,
    team_name: team.short_name,
    element_type: player.element_type,
    position: positionFromElementType(player.element_type),
    now_cost: player.now_cost / 10,
    selected_by_percent: Number.parseFloat(player.selected_by_percent || "0"),
    chance_of_playing_next_round: player.chance_of_playing_next_round,
    total_points: player.total_points,
    form: player.form ?? player.points_per_game ?? "0",
    ict_index: player.ict_index ?? "0",
    status: player.status ?? "a",
  };
}

function startsRate(entries: FplHistoryEntry[]): number {
  const played = entries.filter((entry) => entry.minutes > 0);
  if (played.length === 0) {
    return 0;
  }
  return played.filter((entry) => entry.minutes >= 60).length / played.length;
}

function deriveFeatures(player: Player, historyResponse: FplHistoryResponse, ownershipPercentile: number): PlayerFeatures {
  const history = sortHistory(historyResponse.history);
  const recent5 = getRecent(history, 5);
  const recent3 = getRecent(history, 3);
  const seasonMinutes = sum(history.map((entry) => entry.minutes));
  const totalGames = history.filter((entry) => entry.minutes > 0).length;
  const totalExpectedGoals = sum(history.map((entry) => toNumber(entry.expected_goals)));
  const totalExpectedAssists = sum(history.map((entry) => toNumber(entry.expected_assists)));
  const totalExpectedGoalInvolvements = sum(history.map((entry) => toNumber(entry.expected_goal_involvements)));
  const totalExpectedGoalsConceded = sum(history.map((entry) => toNumber(entry.expected_goals_conceded)));
  const totalPoints = sum(history.map((entry) => entry.total_points));
  const totalCleanSheets = sum(history.map((entry) => entry.clean_sheets));
  const totalBonus = sum(history.map((entry) => entry.bonus));
  const startRate = startsRate(history);

  return {
    player_id: player.id,
    team_id: player.team_id,
    position: player.position,
    rolling_avg_5gw: average(recent5.map((entry) => entry.total_points)),
    form_3gw: average(recent3.map((entry) => entry.total_points)),
    xG_per90: per90(totalExpectedGoals, seasonMinutes),
    xA_per90: per90(totalExpectedAssists, seasonMinutes),
    xGI_per90: per90(totalExpectedGoalInvolvements, seasonMinutes),
    xGC_per90: per90(totalExpectedGoalsConceded, seasonMinutes),
    starts_rate: startRate,
    minutes_per_game: totalGames === 0 ? 0 : seasonMinutes / totalGames,
    season_minutes: seasonMinutes,
    points_per_90: per90(totalPoints, seasonMinutes),
    clean_sheet_rate: totalGames === 0 ? 0 : totalCleanSheets / totalGames,
    bonus_rate: totalGames === 0 ? 0 : totalBonus / totalGames,
    availability_risk: deriveAvailabilityRisk(player.chance_of_playing_next_round, startRate),
    ownership_percentile: ownershipPercentile,
    price: player.now_cost,
  };
}

export function deriveDataset(
  bootstrap: FplBootstrap,
  fixtures: FplFixture[],
  histories: Map<number, FplHistoryResponse>,
): SharedDataset {
  const players = bootstrap.elements.map((element) => derivePlayer(element, bootstrap));
  const ownershipValues = players.map((player) => player.selected_by_percent).sort((left, right) => left - right);
  const currentGameweek = bootstrap.events.find((event) => event.is_current)?.id
    ?? bootstrap.events.find((event) => event.is_next)?.id
    ?? null;

  const playerFeatures = players.map((player) => {
    const history = histories.get(player.id) ?? { history: [], fixtures: [] };
    return deriveFeatures(player, history, percentile(ownershipValues, player.selected_by_percent));
  });

  const fixtureDifficultySummary = bootstrap.teams.map((team) => summarizeUpcomingFixtures(team.id, fixtures, currentGameweek));

  return {
    schemaVersion: 2,
    datasetVersion: new Date().toISOString(),
    currentGameweek,
    refreshedAt: new Date().toISOString(),
    playerCount: players.length,
    players,
    playerFeatures,
    fixtureDifficultySummary,
  };
}
