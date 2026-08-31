import { redirect } from "next/navigation";

/**
 * The review queue is now a tab on the dashboard rather than its own page —
 * an organizer should not have to remember a second URL exists. Kept as a
 * redirect because this path was live.
 */
export default function RequestsRedirect() {
  redirect("/dashboard?tab=requests");
}
