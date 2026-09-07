import { redirect } from "next/navigation";

/** Event management is a tab on the staff console. */
export default function OrganizerRedirect() {
  redirect("/staff?tab=events");
}
