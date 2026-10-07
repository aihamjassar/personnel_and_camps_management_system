import type { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

export interface SystemSettings {
  passwordMinLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  sessionDurationHours: number;
}

export type PasswordPolicy = Pick<
  SystemSettings,
  "passwordMinLength" | "requireUppercase" | "requireNumber" | "requireSymbol"
>;

function fallbackSessionHours(value: string): number {
  const match = /^\s*(\d+)\s*(m|h|d)?\s*$/i.exec(value);
  if (!match) return 8;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  const hours = unit === "d" ? amount * 24 : unit === "h" ? amount : unit === "m" ? amount / 60 : amount / 3600;
  return Math.max(1, Math.min(24, Math.round(hours)));
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  passwordMinLength: 8,
  requireUppercase: false,
  requireNumber: false,
  requireSymbol: false,
  sessionDurationHours: fallbackSessionHours(env.jwtExpiresIn),
};

const settingKeys = Object.keys(DEFAULT_SYSTEM_SETTINGS) as (keyof SystemSettings)[];

function settingsFromRows(
  rows: { setting_key: string; setting_value: Prisma.JsonValue }[],
): SystemSettings {
  const values = new Map(rows.map((row) => [row.setting_key, row.setting_value]));
  const result: Record<keyof SystemSettings, number | boolean> = { ...DEFAULT_SYSTEM_SETTINGS };
  for (const key of settingKeys) {
    const value = values.get(key);
    if (typeof result[key] === "number" && typeof value === "number") {
      result[key] = value;
    } else if (typeof result[key] === "boolean" && typeof value === "boolean") {
      result[key] = value;
    }
  }
  return result as SystemSettings;
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const rows = await prisma.systemSetting.findMany({
    where: { setting_key: { in: settingKeys } },
  });
  return settingsFromRows(rows);
}

export async function saveSystemSettings(
  settings: SystemSettings,
  userId: number,
  ipAddress: string | null,
): Promise<SystemSettings> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.systemSetting.findMany({
      where: { setting_key: { in: settingKeys } },
    });
    const previous = settingsFromRows(rows);

    for (const key of settingKeys) {
      await tx.systemSetting.upsert({
        where: { setting_key: key },
        create: { setting_key: key, setting_value: settings[key] },
        update: { setting_value: settings[key] },
      });
    }

    if (JSON.stringify(previous) !== JSON.stringify(settings)) {
      await tx.auditLog.create({
        data: {
          user_id: userId,
          action_type: "SystemSettingChanged",
          target_table: "SystemSettings",
          old_value: previous as unknown as Prisma.InputJsonValue,
          new_value: settings as unknown as Prisma.InputJsonValue,
          ip_address: ipAddress,
        },
      });
    }
    return settings;
  });
}
