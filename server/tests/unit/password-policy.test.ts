import { describe, expect, it } from "vitest";
import { passwordPolicyViolations } from "../../src/lib/password-policy.js";
import { systemSettingsSchema } from "../../src/validators/schemas.js";
import type { PasswordPolicy } from "../../src/lib/system-settings.js";

const baseline: PasswordPolicy = {
  passwordMinLength: 8,
  requireUppercase: false,
  requireNumber: false,
  requireSymbol: false,
};

describe("passwordPolicyViolations", () => {
  it("accepts passwords meeting the configured minimum length", () => {
    expect(passwordPolicyViolations("plainpass", baseline)).toEqual([]);
  });

  it("reports every failed configured rule", () => {
    expect(passwordPolicyViolations("short", {
      passwordMinLength: 12,
      requireUppercase: true,
      requireNumber: true,
      requireSymbol: true,
    })).toEqual(["minimum length", "uppercase letter", "number", "symbol"]);
  });

  it("accepts a password meeting all enabled character rules", () => {
    expect(passwordPolicyViolations("LongEnough9!", {
      passwordMinLength: 12,
      requireUppercase: true,
      requireNumber: true,
      requireSymbol: true,
    })).toEqual([]);
  });

  it("recognizes Unicode numbers without treating Arabic letters as special characters", () => {
    const unicodePolicy = { passwordMinLength: 8, requireUppercase: false, requireNumber: true, requireSymbol: true };
    expect(passwordPolicyViolations("كلمةمرور١", unicodePolicy)).toEqual(["symbol"]);
    expect(passwordPolicyViolations("كلمةمرور١!", unicodePolicy)).toEqual([]);
  });
});

describe("systemSettingsSchema", () => {
  const valid = {
    passwordMinLength: 8,
    requireUppercase: false,
    requireNumber: false,
    requireSymbol: false,
    sessionDurationHours: 8,
  };

  it("accepts the documented default settings", () => {
    expect(systemSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects password and session values outside the supported bounds", () => {
    expect(systemSettingsSchema.safeParse({ ...valid, passwordMinLength: 7 }).success).toBe(false);
    expect(systemSettingsSchema.safeParse({ ...valid, sessionDurationHours: 25 }).success).toBe(false);
  });

  it("rejects missing or wrongly typed policy flags", () => {
    expect(systemSettingsSchema.safeParse({ ...valid, requireNumber: "yes" }).success).toBe(false);
  });
});
