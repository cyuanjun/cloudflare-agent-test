import type { UserPreferences, UserProfile } from "../../src/domain/contracts";

export const validProfile: UserProfile = {
  schema_version: 1,
  agent_id: "test_001",
  identity: {
    primary_archetype: "operator",
    archetype_scores: {
      operator: 0.6,
      planner: 0.2,
      scout: 0.2,
    },
  },
  enums: {
    risk: "MEDIUM",
    planning_horizon: "SHORT",
    decision_source: "DATA",
    captaincy_style: "SAFE",
    chip_strategy: "FLEXIBLE",
    squad_structure: "BALANCED",
    pressure_response: "ADAPT",
  },
  planning: {
    horizon_gw: 3,
    run_target_gw: 3,
    bank_tendency: 0.4,
  },
  baseline: {
    risk_tolerance: 0.45,
    long_term_planning_bias: 0.3,
    fixture_weight: 0.45,
    form_sensitivity: 0.55,
    transfer_aggression: 0.4,
    differential_appetite: 0.35,
    rotation_tolerance: 0.4,
  },
  pressure: {
    risk_tolerance: 0.6,
    long_term_planning_bias: 0.2,
    fixture_weight: 0.55,
    form_sensitivity: 0.65,
    transfer_aggression: 0.6,
    differential_appetite: 0.5,
    rotation_tolerance: 0.45,
  },
  decision_weights: {
    fixture_difficulty: 0.5,
    recent_form: 0.5,
    expected_stats: 0.55,
    template_blocking_bias: 0.45,
    price_sensitivity: 0.35,
  },
  decision_modifiers: {
    rotation_risk_penalty: 0.7,
    hit_penalty_multiplier: 1,
    captain_differential_bonus: 0.15,
  },
  captaincy: {
    safety: 0.65,
    differential_bias: 0.35,
  },
  mode: {
    current: "BASELINE",
  },
};

export const validPreferences: UserPreferences = {
  schema_version: 1,
  agent_id: "test_001",
  team_preferences: {
    favoured_teams: [1],
    avoided_teams: [],
  },
  player_preferences: {
    locked_players: [],
    banned_players: [],
  },
  budget_preferences: {
    reserved_bank: 0.5,
  },
};
