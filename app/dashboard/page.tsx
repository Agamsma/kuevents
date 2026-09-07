import { redirect } from "next/navigation";

/**
 * The dashboard moved into the staff console at `/staff`.
 *
 * Kept as a redirect rather than deleted: this path is in the wild — bookmarks,
 * and links sent to organizers before the move.
 */
export default function DashboardRedirect() {
  redirect("/staff");
}
