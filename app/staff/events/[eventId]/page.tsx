import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { AttendeeList } from "@/components/attendee-list";

export const metadata: Metadata = {
  title: "Attendees",
  robots: { index: false, follow: false },
};

export default async function AttendeesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <AuthGuard allowedRoles={["organizer", "superadmin"]}>
      <AttendeeList eventId={eventId} />
    </AuthGuard>
  );
}
