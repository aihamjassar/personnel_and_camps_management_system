import { Router } from "express";
import { getSystemSettings, saveSystemSettings, type SystemSettings } from "../lib/system-settings.js";
import { ok } from "../lib/response.js";
import { authenticate, requireAnyPermission, requirePermission } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { systemSettingsSchema } from "../validators/schemas.js";

export const settingsRouter = Router();
settingsRouter.use(authenticate);

// User administrators can read only password requirements to guide account creation.
settingsRouter.get(
  "/password-policy",
  requireAnyPermission("users.manage", "system.admin"),
  async (_req, res, next) => {
    try {
      const settings = await getSystemSettings();
      return ok(res, {
        passwordMinLength: settings.passwordMinLength,
        requireUppercase: settings.requireUppercase,
        requireNumber: settings.requireNumber,
        requireSymbol: settings.requireSymbol,
      });
    } catch (err) {
      next(err);
    }
  },
);

settingsRouter.use(requirePermission("system.admin"));

settingsRouter.get("/", async (_req, res, next) => {
  try {
    return ok(res, { settings: await getSystemSettings() });
  } catch (err) {
    next(err);
  }
});

settingsRouter.put("/", validateBody(systemSettingsSchema), async (req, res, next) => {
  try {
    const settings = req.body as SystemSettings;
    const saved = await saveSystemSettings(settings, req.user!.userId, req.ip ?? null);
    return ok(res, { settings: saved });
  } catch (err) {
    next(err);
  }
});
