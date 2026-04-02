import type {
  FixtureDifficultySummary,
  Player,
  PlayerFeatures,
  PlayerRankingEntry,
  Position,
  RankingArtifact,
  RankingComponents,
  RankingPenalties,
  UserPreferences,
  UserProfile,
} from "./contracts";
import { clamp } from "./utils";

const SHORTLIST_LIMITS: Record<Position, number> = {
  GKP: 10,
  DEF: 25,
  MID: 25,
  FWD: 15,
};

interface JoinedPlayerRow {
  player: Player;
  features: PlayerFeatures;
  fixtureSummary?: FixtureDifficultySummary;
}

interface ScoringContext {
  fixtureScores: Map<number, number>;
  expectedScores: Map<number, number>;
  upsideScores: Map<number, number>;
  formScores: Map<number, number>;
  valueScores: Map<number, number>;
  ownershipScores: Map<number, number>;
  confidenceScores: Map<number, number>;
}

function emptyRankings(): Record<Position, PlayerRankingEntry[]> {
  return { GKP: [], DEF: [], MID: [], FWD: [] };
}

function normalizeByPosition(entries: Array<{ playerId: number; position: Position; value: number }>): Map<number, number> {
  const byPosition = new Map<Position, Array<{ playerId: number; value: number }>>();
  for (const entry of entries) {
    const bucket = byPosition.get(entry.position) ?? [];
    bucket.push({ playerId: entry.playerId, value: entry.value });
    byPosition.set(entry.position, bucket);
  }

  const output = new Map<number, number>();
  for (const [, bucket] of byPosition) {
    const min = Math.min(...bucket.map((entry) => entry.value));
    const max = Math.max(...bucket.map((entry) => entry.value));
    for (const entry of bucket) {
      output.set(entry.playerId, max === min ? 0.5 : (entry.value - min) / (max - min));
    }
  }
  return output;
}

function activeMode(profile: UserProfile): UserProfile["baseline"] | UserProfile["pressure"] {
  return profile.mode.current === "PRESSURE" ? profile.pressure : profile.baseline;
}

function fixtureSignal(row: JoinedPlayerRow, horizonGw: number): number {
  const summary = row.fixtureSummary;
  const fdr = horizonGw <= 3 ? summary?.fdr_avg_next_3gw : summary?.fdr_avg_next_6gw;
  if (fdr == null) {
    return 0;
  }
  return Math.max(0, 5 - fdr) / 4;
}

function goalkeeperExpectedSignal(row: JoinedPlayerRow): number {
  const cappedBonusRate = Math.min(row.features.bonus_rate, 0.35);
  const defensiveResilience = Math.max(0, 2 - row.features.xGC_per90) / 2;
  return row.features.clean_sheet_rate * 0.6 + defensiveResilience * 0.3 + cappedBonusRate * 0.1;
}

function expectedSignal(row: JoinedPlayerRow): number {
  switch (row.player.position) {
    case "GKP":
      return goalkeeperExpectedSignal(row);
    case "DEF":
      return row.features.clean_sheet_rate * 0.45 + row.features.xGI_per90 * 0.4 + Math.max(0, 2 - row.features.xGC_per90) / 2 * 0.15;
    case "MID":
      return row.features.xGI_per90 * 0.55 + row.features.xG_per90 * 0.2 + row.features.xA_per90 * 0.25;
    case "FWD":
      return row.features.xG_per90 * 0.6 + row.features.xGI_per90 * 0.4;
  }
}

function upsideSignal(row: JoinedPlayerRow): number {
  switch (row.player.position) {
    case "GKP":
    case "DEF":
      return 0;
    case "MID":
      return row.features.xG_per90 * row.features.xG_per90 * 0.6 + row.features.xG_per90 * 0.4;
    case "FWD":
      return row.features.xG_per90 * row.features.xG_per90 * 0.7 + row.features.xGI_per90 * 0.3;
  }
}

function ownershipSignal(row: JoinedPlayerRow, preferences: UserPreferences): number {
  const favouredTeams = new Set(preferences.team_preferences.favoured_teams);
  const base = row.features.ownership_percentile / 100 * 0.6 + clamp(row.player.selected_by_percent / 100) * 0.4;
  return favouredTeams.has(row.player.team_id) ? Math.min(1, base + 0.1) : base;
}

function valueSignal(row: JoinedPlayerRow): number {
  switch (row.player.position) {
    case "GKP":
    case "DEF":
      return row.features.points_per_90 / Math.max(row.features.price, 0.1);
    case "MID":
      return (row.features.xGI_per90 * 0.75 + row.features.xG_per90 * 0.2 + row.features.points_per_90 * 0.1) / Math.max(row.features.price, 0.1);
    case "FWD":
      return (row.features.xG_per90 * 0.7 + row.features.xGI_per90 * 0.25 + row.features.points_per_90 * 0.05) / Math.max(row.features.price, 0.1);
  }
}

function blockerAppetite(profile: UserProfile, mode: UserProfile["baseline"] | UserProfile["pressure"]): number {
  return clamp(profile.decision_weights.template_blocking_bias * (1 - mode.risk_tolerance) * (1 - mode.differential_appetite));
}

function differentialAppetite(profile: UserProfile, mode: UserProfile["baseline"] | UserProfile["pressure"]): number {
  return clamp(mode.differential_appetite * mode.risk_tolerance * (1 - profile.decision_weights.template_blocking_bias));
}

function premiumBlockerSignal(row: JoinedPlayerRow): number {
  const priceSignal = clamp((row.features.price - 7) / 5);
  switch (row.player.position) {
    case "FWD":
      return priceSignal;
    case "MID":
      return priceSignal * 0.9;
    case "DEF":
      return clamp((row.features.price - 5.5) / 2.5) * 0.35;
    case "GKP":
      return clamp((row.features.price - 5) / 1.5) * 0.2;
  }
}

function positionWeight(position: Position, family: "fixture" | "ownership" | "value" | "upside"): number {
  if (family === "fixture") {
    return position === "GKP" || position === "DEF" ? 1 : position === "MID" ? 0.7 : 0.6;
  }
  if (family === "ownership") {
    return position === "GKP" || position === "DEF" ? 1 : position === "MID" ? 0.55 : 0.45;
  }
  if (family === "value") {
    return position === "GKP" || position === "DEF" ? 1 : position === "MID" ? 0.45 : 0.2;
  }
  return position === "MID" ? 0.6 : position === "FWD" ? 0.8 : 0;
}

function differentialOwnershipPenalty(position: Position, differentialBias: number): number {
  switch (position) {
    case "GKP":
      return differentialBias * 0.15;
    case "DEF":
      return differentialBias * 0.3;
    case "MID":
      return differentialBias * 1.15;
    case "FWD":
      return differentialBias * 1.3;
  }
}

function blockerPositionBonus(position: Position): number {
  switch (position) {
    case "GKP":
      return 0.1;
    case "DEF":
      return 0.2;
    case "MID":
      return 0.55;
    case "FWD":
      return 0.7;
  }
}

function confidenceTarget(position: Position): number {
  return position === "MID" || position === "FWD" ? 1080 : 900;
}

function sampleConfidence(row: JoinedPlayerRow): number {
  return Math.min(1, row.features.season_minutes / confidenceTarget(row.player.position));
}

function buildScoringContext(rows: JoinedPlayerRow[], profile: UserProfile, preferences: UserPreferences): ScoringContext {
  return {
    fixtureScores: normalizeByPosition(rows.map((row) => ({ playerId: row.player.id, position: row.player.position, value: fixtureSignal(row, profile.planning.horizon_gw) }))),
    expectedScores: normalizeByPosition(rows.map((row) => ({ playerId: row.player.id, position: row.player.position, value: expectedSignal(row) }))),
    upsideScores: normalizeByPosition(rows.map((row) => ({ playerId: row.player.id, position: row.player.position, value: upsideSignal(row) }))),
    formScores: normalizeByPosition(rows.map((row) => ({ playerId: row.player.id, position: row.player.position, value: row.features.form_3gw }))),
    valueScores: normalizeByPosition(rows.map((row) => ({ playerId: row.player.id, position: row.player.position, value: valueSignal(row) }))),
    ownershipScores: normalizeByPosition(rows.map((row) => ({ playerId: row.player.id, position: row.player.position, value: ownershipSignal(row, preferences) }))),
    confidenceScores: new Map(rows.map((row) => [row.player.id, sampleConfidence(row)])),
  };
}

function buildComponents(row: JoinedPlayerRow, profile: UserProfile, context: ScoringContext): RankingComponents {
  const mode = activeMode(profile);
  const blockerBias = blockerAppetite(profile, mode);
  const differentialBias = differentialAppetite(profile, mode);
  const playerId = row.player.id;
  const confidence = context.confidenceScores.get(playerId) ?? 0;
  const expectedScore = (context.expectedScores.get(playerId) ?? 0) * confidence;
  const formScore = (context.formScores.get(playerId) ?? 0) * (0.35 + 0.65 * confidence);
  const valueScore = (context.valueScores.get(playerId) ?? 0) * confidence;
  const fixtureConfidence = row.player.position === "MID" || row.player.position === "FWD" ? 0.4 + 0.6 * confidence : 1;
  const upsideScore = (context.upsideScores.get(playerId) ?? 0) * confidence * confidence;
  const ownershipBase = context.ownershipScores.get(playerId) ?? 0;
  const blockerBonus = blockerBias * premiumBlockerSignal(row) * Math.max(expectedScore, upsideScore, ownershipBase);
  const differentialBonus = differentialBias * (1 - ownershipBase) * (expectedScore * 0.2 + formScore * 0.35 + upsideScore * 0.8 + valueScore * 0.15);
  const ownershipTerm = ownershipBase * (1 + blockerBias * blockerPositionBonus(row.player.position)) - ownershipBase * differentialOwnershipPenalty(row.player.position, differentialBias);

  return {
    fixture: (context.fixtureScores.get(playerId) ?? 0) * profile.decision_weights.fixture_difficulty * positionWeight(row.player.position, "fixture") * fixtureConfidence,
    expected_stats: expectedScore * profile.decision_weights.expected_stats,
    upside: upsideScore * profile.decision_weights.expected_stats * positionWeight(row.player.position, "upside"),
    form: formScore * profile.decision_weights.recent_form,
    value: valueScore * profile.decision_weights.price_sensitivity * positionWeight(row.player.position, "value"),
    ownership: (ownershipTerm + blockerBonus + differentialBonus) * Math.max(profile.decision_weights.template_blocking_bias, mode.differential_appetite) * positionWeight(row.player.position, "ownership"),
  };
}

function buildPenalties(row: JoinedPlayerRow, profile: UserProfile): RankingPenalties {
  const mode = activeMode(profile);
  return {
    rotation: (1 - row.features.starts_rate) * (1 - mode.rotation_tolerance) * profile.decision_modifiers.rotation_risk_penalty,
    availability: row.features.availability_risk,
  };
}

function totalScore(components: RankingComponents, penalties: RankingPenalties): number {
  return components.fixture + components.expected_stats + components.upside + components.form + components.value + components.ownership - penalties.rotation - penalties.availability;
}

function topSignals(row: JoinedPlayerRow, components: RankingComponents, penalties: RankingPenalties, context: ScoringContext): string[] {
  const signals: string[] = [];
  const confidence = context.confidenceScores.get(row.player.id) ?? 0;
  if (components.fixture >= 0.7) signals.push("strong_fixture_signal");
  if (components.expected_stats >= 0.75) signals.push(`high_expected_stats_${row.player.position.toLowerCase()}`);
  if (components.upside >= 0.4) signals.push("elite_upside");
  if (row.features.starts_rate < 0.75 && penalties.rotation >= 0.15) signals.push("minutes_risk");
  if (penalties.availability > 0.2) signals.push("availability_risk");
  if (confidence < 0.5) signals.push("small_sample");
  return signals.slice(0, 4);
}

function determineThresholds(currentGameweek: number | null): { minGames: number; minMinutes: number; seasonPhase: string } {
  if (currentGameweek == null || currentGameweek <= 4) {
    return { minGames: 1, minMinutes: 30, seasonPhase: "opening" };
  }
  if (currentGameweek <= 10) {
    return { minGames: 2, minMinutes: 90, seasonPhase: "early" };
  }
  return { minGames: 3, minMinutes: 180, seasonPhase: "established" };
}

export function buildRankingArtifact(
  profile: UserProfile,
  preferences: UserPreferences,
  players: Player[],
  playerFeatures: PlayerFeatures[],
  fixtureDifficultySummary: FixtureDifficultySummary[],
  datasetVersion: string,
  currentGameweek: number | null,
): RankingArtifact {
  const featureByPlayerId = new Map(playerFeatures.map((feature) => [feature.player_id, feature]));
  const fixtureByTeamId = new Map(fixtureDifficultySummary.map((summary) => [summary.team_id, summary]));
  const thresholds = determineThresholds(currentGameweek);
  const bannedPlayers = new Set(preferences.player_preferences.banned_players);
  const avoidedTeams = new Set(preferences.team_preferences.avoided_teams);
  const lockedPlayers = new Set(preferences.player_preferences.locked_players);
  const excludedCounts = { banned: 0, avoidedTeam: 0, insufficientSample: 0, unavailable: 0 };

  const rows: JoinedPlayerRow[] = [];
  for (const player of players) {
    const features = featureByPlayerId.get(player.id);
    if (!features) {
      continue;
    }
    if (bannedPlayers.has(player.id)) {
      excludedCounts.banned += 1;
      continue;
    }
    if (avoidedTeams.has(player.team_id) && !lockedPlayers.has(player.id)) {
      excludedCounts.avoidedTeam += 1;
      continue;
    }
    const gamesPlayed = features.minutes_per_game > 0 ? features.season_minutes / Math.max(1, features.minutes_per_game) : 0;
    if (gamesPlayed < thresholds.minGames || features.season_minutes < thresholds.minMinutes) {
      excludedCounts.insufficientSample += 1;
      continue;
    }
    if (features.availability_risk >= 0.95 && !lockedPlayers.has(player.id)) {
      excludedCounts.unavailable += 1;
      continue;
    }
    rows.push({ player, features, fixtureSummary: fixtureByTeamId.get(player.team_id) });
  }

  const scoringContext = buildScoringContext(rows, profile, preferences);
  const rankings = emptyRankings();
  for (const row of rows) {
    const components = buildComponents(row, profile, scoringContext);
    const penalties = buildPenalties(row, profile);
    rankings[row.player.position].push({
      playerId: row.player.id,
      name: row.player.web_name || `${row.player.first_name} ${row.player.second_name}`.trim(),
      teamId: row.player.team_id,
      teamName: row.player.team_name,
      position: row.player.position,
      price: row.features.price,
      score: totalScore(components, penalties),
      rankWithinPosition: 0,
      shortlisted: false,
      components,
      penalties,
      signals: topSignals(row, components, penalties, scoringContext),
    });
  }

  const shortlists = emptyRankings();
  for (const position of ["GKP", "DEF", "MID", "FWD"] as const) {
    rankings[position].sort((left, right) => right.score - left.score);
    rankings[position] = rankings[position].map((entry, index) => ({ ...entry, rankWithinPosition: index + 1 }));
    const shortlistIds = new Set(rankings[position].slice(0, SHORTLIST_LIMITS[position]).map((entry) => entry.playerId));
    for (const playerId of lockedPlayers) {
      const match = rankings[position].find((entry) => entry.playerId === playerId);
      if (match) {
        shortlistIds.add(playerId);
      }
    }
    shortlists[position] = rankings[position].filter((entry) => shortlistIds.has(entry.playerId)).map((entry) => ({ ...entry, shortlisted: true }));
    rankings[position] = rankings[position].map((entry) => ({ ...entry, shortlisted: shortlistIds.has(entry.playerId) }));
  }

  return {
    agent: "player_ranking",
    profileId: profile.agent_id,
    datasetVersion,
    generatedAt: new Date().toISOString(),
    filtersApplied: {
      bannedPlayers: preferences.player_preferences.banned_players,
      avoidedTeams: preferences.team_preferences.avoided_teams,
      lockedPlayers: preferences.player_preferences.locked_players,
    },
    eligibility: {
      seasonPhase: thresholds.seasonPhase,
      currentGameweek,
      thresholds: {
        minGames: thresholds.minGames,
        minMinutes: thresholds.minMinutes,
      },
      excludedCounts,
    },
    rankings,
    shortlists,
  };
}
