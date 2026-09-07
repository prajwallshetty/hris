import { formatDistanceToNowStrict } from "date-fns";

/** "Edited 7 hrs ago" style caption for a record header's meta line. */
export function formatRelativeTime(date: Date): string {
  return `${formatDistanceToNowStrict(date, { addSuffix: false })} ago`;
}
