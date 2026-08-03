import { describe, expect, it } from "vitest";
import { validatePasswordStrength } from "./passwordPolicy";

describe("validatePasswordStrength", () => {
  it("accepts a password meeting all rules", () => {
    expect(validatePasswordStrength("Abcdef12")).toBeNull();
  });

  it("rejects passwords under 8 characters", () => {
    expect(validatePasswordStrength("Ab1")).toMatch(/at least 8 characters/);
  });

  it("rejects a password missing a lowercase letter", () => {
    expect(validatePasswordStrength("ABCDEF12")).toMatch(/lowercase/);
  });

  it("rejects a password missing an uppercase letter", () => {
    expect(validatePasswordStrength("abcdef12")).toMatch(/uppercase/);
  });

  it("rejects a password missing a number", () => {
    expect(validatePasswordStrength("Abcdefgh")).toMatch(/number/);
  });
});
