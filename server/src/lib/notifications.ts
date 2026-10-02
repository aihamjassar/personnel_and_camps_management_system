import { prisma } from "./prisma.js";

/**
 * Creates Notification rows for the given users.
 * Callers are responsible for passing valid active user ids.
 */
export async function createNotifications(
  userIds: number[],
  title: string,
  message: string,
): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await prisma.notification.createMany({
    data: unique.map((user_id) => ({ user_id, title, message })),
  });
}

/** Returns active user ids that hold a specific permission. */
export async function activeUsersWithPermission(permissionKey: string): Promise<number[]> {
  const users = await prisma.user.findMany({
    where: {
      is_active: true,
      roles: { some: { role: { permissions: { some: { permission: { permission_key: permissionKey } } } } } },
    },
    select: { user_id: true },
  });
  return users.map((u) => u.user_id);
}

/**
 * Notifies all active users holding a permission, optionally excluding one
 * (typically the actor who triggered the event).
 */
export async function notifyPermissionHolders(
  permissionKey: string,
  title: string,
  message: string,
  excludeUserId?: number,
): Promise<void> {
  const ids = await activeUsersWithPermission(permissionKey);
  await createNotifications(ids.filter((id) => id !== excludeUserId), title, message);
}
