import type { UserPreferences, UserProfile } from "./contracts";

export const referenceProfileTemplate: UserProfile = {
  schema_version: 1,
  agent_id: "reference_profile",
  identity: {
    primary_archetype: "operator",
    archetype_scores: {
      guardian: 0.15,
      operator: 0.5,
      planner: 0.2,
      scout: 0.1,
      challenger: 0.05,
    },
  },
  enums: {
    risk: "MEDIUM",
    planning_horizon: "SHORT",
    decision_source: "DATA_WITH_INSTINCT_TIEBREAK",
    captaincy_style: "SAFE_WITH_UPSIDE",
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
    long_term_planning_bias: 0.35,
    fixture_weight: 0.45,
    form_sensitivity: 0.55,
    transfer_aggression: 0.45,
    differential_appetite: 0.4,
    rotation_tolerance: 0.35,
  },
  pressure: {
    risk_tolerance: 0.6,
    long_term_planning_bias: 0.2,
    fixture_weight: 0.5,
    form_sensitivity: 0.65,
    transfer_aggression: 0.65,
    differential_appetite: 0.55,
    rotation_tolerance: 0.45,
  },
  decision_weights: {
    fixture_difficulty: 0.5,
    recent_form: 0.5,
    expected_stats: 0.55,
    template_blocking_bias: 0.45,
    price_sensitivity: 0.4,
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
  compiled_prompt_profile: {
    short_summary: "Balanced operator profile with moderate risk and xStats-led decisions.",
    last_compiled_at: "2026-03-30T00:00:00.000Z",
  },
};

export const referencePreferencesTemplate: UserPreferences = {
  schema_version: 1,
  agent_id: "reference_profile",
  team_preferences: {
    favoured_teams: [],
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

export function getTemplate(name: string): object | null {
  if (name === "user_profile.json") {
    return referenceProfileTemplate;
  }
  if (name === "user_preferences.json") {
    return referencePreferencesTemplate;
  }
  return null;
}
