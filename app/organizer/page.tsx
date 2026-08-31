import { redirect } from "next/navigation";

/**
 * Event management moved into the tabbed dashboard at /dashboard.
 *
 * Kept as a redirect rather than deleted: this path is in the wild — bookmarks,
 * and any link sent to an organizer before the move.
 */
export default function OrganizerRedirect() {
  redirect("/dashboard?tab=events");
}
