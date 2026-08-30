import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { EventDetail } from "@/components/event-detail";

export const metadata: Metadata = {
  title: "Event",
};

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <AuthGuard>
      <EventDetail eventId={eventId} />
    </AuthGuard>
  );
}
