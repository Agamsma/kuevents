import { redirect } from "next/navigation";

/**
 * The review queue is a tab on the staff console rather than its own page — an
 * organizer should not have to remember a second URL exists. The `?tab=` is
 * preserved through the move, or an organizer following an old link lands on
 * the wrong tab.
 */
export default function RequestsRedirect() {
  redirect("/staff?tab=requests");
}
