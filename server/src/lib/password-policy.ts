import type { PasswordPolicy } from "./system-settings.js";

export function passwordPolicyViolations(password: string, policy: PasswordPolicy): string[] {
  const violations: string[] = [];
  if (password.length < policy.passwordMinLength) violations.push("minimum length");
  if (policy.requireUppercase && !/[A-Z]/.test(password)) violations.push("uppercase letter");
  if (policy.requireNumber && !/\p{N}/u.test(password)) violations.push("number");
  if (policy.requireSymbol && !/[^\p{L}\p{N}]/u.test(password)) violations.push("symbol");
  return violations;
}
