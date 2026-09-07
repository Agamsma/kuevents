import { redirect } from "next/navigation";

/** The attendee roster moved to `/staff/events/[eventId]`. */
export default async function OrganizerEventRedirect({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  redirect(`/staff/events/${eventId}`);
}
