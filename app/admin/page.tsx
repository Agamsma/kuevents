import { redirect } from "next/navigation";

/** People and roles moved to `/staff/people`. */
export default function AdminRedirect() {
  redirect("/staff/people");
}
