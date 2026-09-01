import { getNotifications } from "@/server/queries/notifications";
import { getSessionUser } from "@/server/session";

import { NotificationsDropdown } from "./notifications-dropdown";

export async function NotificationsBell() {
  const user = await getSessionUser();
  const notifications = await getNotifications(user);
  return <NotificationsDropdown notifications={notifications} />;
}
