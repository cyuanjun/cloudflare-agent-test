import type { RunInput, UserPreferences, UserProfile } from "./contracts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNumberRange(value: unknown, path: string, min = 0, max = 1): asserts value is number {
  if (!isFiniteNumber(value)) {
    throw new Error(`${path} must be a number.`);
  }
  if (value < min || value > max) {
    throw new Error(`${path} must be between ${min} and ${max}.`);
  }
}

function assertIntegerArray(value: unknown, path: string): asserts value is number[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }
  for (const item of value) {
    assert(Number.isInteger(item), `${path} must contain integer ids.`);
  }
}

function validateProfileModeSettings(value: unknown, path: string): void {
  assert(isObject(value), `${path} must be an object.`);
  const obj = value as Record<string, unknown>;
  assertNumberRange(obj.risk_tolerance, `${path}.risk_tolerance`);
  assertNumberRange(obj.long_term_planning_bias, `${path}.long_term_planning_bias`);
  assertNumberRange(obj.fixture_weight, `${path}.fixture_weight`);
  assertNumberRange(obj.form_sensitivity, `${path}.form_sensitivity`);
  assertNumberRange(obj.transfer_aggression, `${path}.transfer_aggression`);
  assertNumberRange(obj.differential_appetite, `${path}.differential_appetite`);
  assertNumberRange(obj.rotation_tolerance, `${path}.rotation_tolerance`);
}

export function validateUserProfile(value: unknown): UserProfile {
  assert(isObject(value), "userProfile must be an object.");
  const obj = value as Record<string, unknown>;
  assert(Number.isInteger(obj.schema_version), "userProfile.schema_version must be an integer.");
  assert(typeof obj.agent_id === "string" && obj.agent_id.length > 0, "userProfile.agent_id must be a non-empty string.");
  assert(isObject(obj.identity), "userProfile.identity must be an object.");
  const identity = obj.identity as Record<string, unknown>;
  assert(typeof identity.primary_archetype === "string", "userProfile.identity.primary_archetype must be a string.");
  assert(isObject(identity.archetype_scores), "userProfile.identity.archetype_scores must be an object.");
  assert(isObject(obj.enums), "userProfile.enums must be an object.");
  assert(isObject(obj.planning), "userProfile.planning must be an object.");
  const planning = obj.planning as Record<string, unknown>;
  assert(isFiniteNumber(planning.horizon_gw), "userProfile.planning.horizon_gw must be a number.");
  assert(isFiniteNumber(planning.run_target_gw), "userProfile.planning.run_target_gw must be a number.");
  assertNumberRange(planning.bank_tendency, "userProfile.planning.bank_tendency");
  validateProfileModeSettings(obj.baseline, "userProfile.baseline");
  validateProfileModeSettings(obj.pressure, "userProfile.pressure");
  assert(isObject(obj.decision_weights), "userProfile.decision_weights must be an object.");
  const decisionWeights = obj.decision_weights as Record<string, unknown>;
  assertNumberRange(decisionWeights.fixture_difficulty, "userProfile.decision_weights.fixture_difficulty");
  assertNumberRange(decisionWeights.recent_form, "userProfile.decision_weights.recent_form");
  assertNumberRange(decisionWeights.expected_stats, "userProfile.decision_weights.expected_stats");
  assertNumberRange(decisionWeights.template_blocking_bias, "userProfile.decision_weights.template_blocking_bias");
  assertNumberRange(decisionWeights.price_sensitivity, "userProfile.decision_weights.price_sensitivity");
  assert(isObject(obj.decision_modifiers), "userProfile.decision_modifiers must be an object.");
  const decisionModifiers = obj.decision_modifiers as Record<string, unknown>;
  assertNumberRange(decisionModifiers.rotation_risk_penalty, "userProfile.decision_modifiers.rotation_risk_penalty", 0, 2);
  assertNumberRange(decisionModifiers.hit_penalty_multiplier, "userProfile.decision_modifiers.hit_penalty_multiplier", 0, 5);
  assertNumberRange(decisionModifiers.captain_differential_bonus, "userProfile.decision_modifiers.captain_differential_bonus", 0, 2);
  assert(isObject(obj.captaincy), "userProfile.captaincy must be an object.");
  const captaincy = obj.captaincy as Record<string, unknown>;
  assertNumberRange(captaincy.safety, "userProfile.captaincy.safety");
  assertNumberRange(captaincy.differential_bias, "userProfile.captaincy.differential_bias");
  assert(isObject(obj.mode), "userProfile.mode must be an object.");
  const mode = obj.mode as Record<string, unknown>;
  assert(mode.current === "BASELINE" || mode.current === "PRESSURE", "userProfile.mode.current must be BASELINE or PRESSURE.");
  return value as UserProfile;
}

export function validateUserPreferences(value: unknown): UserPreferences {
  assert(isObject(value), "userPreferences must be an object.");
  const obj = value as Record<string, unknown>;
  assert(Number.isInteger(obj.schema_version), "userPreferences.schema_version must be an integer.");
  assert(typeof obj.agent_id === "string" && obj.agent_id.length > 0, "userPreferences.agent_id must be a non-empty string.");
  assert(isObject(obj.team_preferences), "userPreferences.team_preferences must be an object.");
  const teamPreferences = obj.team_preferences as Record<string, unknown>;
  assertIntegerArray(teamPreferences.favoured_teams, "userPreferences.team_preferences.favoured_teams");
  assertIntegerArray(teamPreferences.avoided_teams, "userPreferences.team_preferences.avoided_teams");
  assert(isObject(obj.player_preferences), "userPreferences.player_preferences must be an object.");
  const playerPreferences = obj.player_preferences as Record<string, unknown>;
  assertIntegerArray(playerPreferences.locked_players, "userPreferences.player_preferences.locked_players");
  assertIntegerArray(playerPreferences.banned_players, "userPreferences.player_preferences.banned_players");
  assert(isObject(obj.budget_preferences), "userPreferences.budget_preferences must be an object.");
  const budgetPreferences = obj.budget_preferences as Record<string, unknown>;
  assertNumberRange(budgetPreferences.reserved_bank, "userPreferences.budget_preferences.reserved_bank", 0, 20);
  return value as UserPreferences;
}

export function validateRunInput(value: unknown): RunInput {
  assert(isObject(value), "Request body must be an object.");
  const obj = value as Record<string, unknown>;
  return {
    userProfile: validateUserProfile(obj.userProfile),
    userPreferences: validateUserPreferences(obj.userPreferences),
  };
}
