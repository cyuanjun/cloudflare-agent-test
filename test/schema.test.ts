import { describe, expect, it } from "vitest";
import { validateRunInput } from "../src/domain/schemas";
import { validPreferences, validProfile } from "./fixtures/referenceInputs";

describe("validateRunInput", () => {
  it("accepts valid reference-style payloads", () => {
    const result = validateRunInput({
      userProfile: validProfile,
      userPreferences: validPreferences,
    });

    expect(result.userProfile.agent_id).toBe("test_001");
    expect(result.userPreferences.budget_preferences.reserved_bank).toBe(0.5);
  });

  it("rejects invalid payloads", () => {
    expect(() => validateRunInput({
      userProfile: { ...validProfile, mode: { current: "INVALID" } },
      userPreferences: validPreferences,
    })).toThrow(/mode\.current/);
  });
});
