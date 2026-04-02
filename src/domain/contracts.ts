export const POSITION_ORDER = ["GKP", "DEF", "MID", "FWD"] as const;
export type Position = (typeof POSITION_ORDER)[number];

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface ProfileModeSettings {
  risk_tolerance: number;
  long_term_planning_bias: number;
  fixture_weight: number;
  form_sensitivity: number;
  transfer_aggression: number;
  differential_appetite: number;
  rotation_tolerance: number;
}

export interface UserProfile {
  schema_version: number;
  agent_id: string;
  identity: {
    primary_archetype: string;
    archetype_scores: Record<string, number>;
  };
  enums: {
    risk: string;
    planning_horizon: string;
    decision_source: string;
    captaincy_style: string;
    chip_strategy: string;
    squad_structure: string;
    pressure_response: string;
  };
  planning: {
    horizon_gw: number;
    run_target_gw: number;
    bank_tendency: number;
  };
  baseline: ProfileModeSettings;
  pressure: ProfileModeSettings;
  decision_weights: {
    fixture_difficulty: number;
    recent_form: number;
    expected_stats: number;
    template_blocking_bias: number;
    price_sensitivity: number;
  };
  decision_modifiers: {
    rotation_risk_penalty: number;
    hit_penalty_multiplier: number;
    captain_differential_bonus: number;
  };
  captaincy: {
    safety: number;
    differential_bias: number;
  };
  mode: {
    current: "BASELINE" | "PRESSURE";
  };
  compiled_prompt_profile?: {
    short_summary: string;
    last_compiled_at: string;
  };
}

export interface UserPreferences {
  schema_version: number;
  agent_id: string;
  team_preferences: {
    favoured_teams: number[];
    avoided_teams: number[];
  };
  player_preferences: {
    locked_players: number[];
    banned_players: number[];
  };
  budget_preferences: {
    reserved_bank: number;
  };
}

export interface FplBootstrap {
  elements: FplElement[];
  teams: FplTeam[];
  events: FplEvent[];
  element_types: Array<{ id: number; singular_name_short: string }>;
}

export interface FplElement {
  id: number;
  first_name: string;
  second_name: string;
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  selected_by_percent: string;
  chance_of_playing_next_round: number | null;
  minutes: number;
  points_per_game: string;
  total_points: number;
  form?: string;
  ict_index?: string;
  status?: string;
}

export interface FplTeam {
  id: number;
  name: string;
  short_name: string;
}

export interface FplEvent {
  id: number;
  finished: boolean;
  is_current: boolean;
  is_next: boolean;
  deadline_time: string;
}

export interface FplFixture {
  id: number;
  event: number | null;
  team_a: number;
  team_h: number;
  team_a_difficulty: number;
  team_h_difficulty: number;
  finished: boolean;
}

export interface FplHistoryResponse {
  history: FplHistoryEntry[];
  fixtures: FplUpcomingFixture[];
}

export interface FplHistoryEntry {
  element: number;
  round: number;
  opponent_team: number;
  total_points: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  bonus: number;
  expected_goals: string | number;
  expected_assists: string | number;
  expected_goal_involvements: string | number;
  expected_goals_conceded: string | number;
  value: number;
}

export interface FplUpcomingFixture {
  event: number | null;
  is_home: boolean;
  team_h: number;
  team_a: number;
  difficulty: number;
}

export interface Player {
  id: number;
  first_name: string;
  second_name: string;
  web_name: string;
  team_id: number;
  team_name: string;
  element_type: number;
  position: Position;
  now_cost: number;
  selected_by_percent: number;
  chance_of_playing_next_round: number | null;
  total_points: number;
  form: string;
  ict_index: string;
  status: string;
}

export interface PlayerFeatures {
  player_id: number;
  team_id: number;
  position: Position;
  rolling_avg_5gw: number;
  form_3gw: number;
  xG_per90: number;
  xA_per90: number;
  xGI_per90: number;
  xGC_per90: number;
  starts_rate: number;
  minutes_per_game: number;
  season_minutes: number;
  points_per_90: number;
  clean_sheet_rate: number;
  bonus_rate: number;
  availability_risk: number;
  ownership_percentile: number;
  price: number;
}

export interface FixtureDifficultySummary {
  team_id: number;
  fdr_next_1gw: number | null;
  fdr_avg_next_3gw: number | null;
  fdr_avg_next_6gw: number | null;
  fdr_avg_next_8gw: number | null;
  dgw_gameweeks: number[];
  bgw_gameweeks: number[];
}

export interface RankingComponents {
  fixture: number;
  expected_stats: number;
  upside: number;
  form: number;
  value: number;
  ownership: number;
}

export interface RankingPenalties {
  rotation: number;
  availability: number;
}

export interface PlayerRankingEntry {
  playerId: number;
  name: string;
  teamId: number;
  teamName: string;
  position: Position;
  price: number;
  score: number;
  rankWithinPosition: number;
  shortlisted: boolean;
  components: RankingComponents;
  penalties: RankingPenalties;
  signals: string[];
}

export interface RankingArtifact {
  agent: "player_ranking";
  profileId: string;
  datasetVersion: string;
  generatedAt: string;
  filtersApplied: {
    bannedPlayers: number[];
    avoidedTeams: number[];
    lockedPlayers: number[];
  };
  eligibility: {
    seasonPhase: string;
    currentGameweek: number | null;
    thresholds: {
      minGames: number;
      minMinutes: number;
    };
    excludedCounts: {
      banned: number;
      avoidedTeam: number;
      insufficientSample: number;
      unavailable: number;
    };
  };
  rankings: Record<Position, PlayerRankingEntry[]>;
  shortlists: Record<Position, PlayerRankingEntry[]>;
}

export interface SquadPlayer {
  playerId: number;
  name: string;
  teamId: number;
  teamName: string;
  position: Position;
  price: number;
  score: number;
  rankWithinPosition: number;
}

export interface SquadArtifact {
  agent: "squad_optimizer";
  profileId: string;
  datasetVersion: string;
  generatedAt: string;
  squad: SquadPlayer[];
  totalCost: number;
  budgetRemaining: number;
  totalScore: number;
  solverStats: {
    nodesExplored: number;
  };
  constraintViolations: Array<{
    type: string;
    detail: string;
  }>;
}

export interface RunResult {
  profileId: string;
  generatedAt: string;
  datasetVersion: string;
  rankings: RankingArtifact["rankings"];
  shortlists: RankingArtifact["shortlists"];
  squad: SquadArtifact["squad"];
  totalCost: number;
  budgetRemaining: number;
  totalScore: number;
  constraintViolations: SquadArtifact["constraintViolations"];
}

export interface RunRecord {
  runId: string;
  status: RunStatus;
  progress: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
  result?: RunResult;
  profileId?: string;
}

export interface RunInput {
  userProfile: UserProfile;
  userPreferences: UserPreferences;
}

export interface Env {
  RUN_AGENT: DurableObjectNamespace;
  DATASET_CACHE: DurableObjectNamespace;
  AGENT_REGISTRY: DurableObjectNamespace;
  FPL_BASE_URL?: string;
}

export interface AgentSummary {
  runId: string;
  profileId: string | null;
  status: RunStatus;
  progress: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface SharedDataset {
  schemaVersion: number;
  datasetVersion: string;
  currentGameweek: number | null;
  refreshedAt: string;
  playerCount: number;
  players: Player[];
  playerFeatures: PlayerFeatures[];
  fixtureDifficultySummary: FixtureDifficultySummary[];
}
