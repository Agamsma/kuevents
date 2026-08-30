import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { TicketPass } from "@/components/ticket-pass";

export const metadata: Metadata = {
  title: "Your pass",
  // A pass is personal; keep it out of search indexes and link previews.
  robots: { index: false, follow: false },
};

/**
 * The read itself happens client-side, as the signed-in user, so Firestore
 * rules — not this route — decide whether the pass is visible. That keeps one
 * copy of the "only the holder may read a ticket" rule instead of two.
 */
export default async function TicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;

  return (
    <AuthGuard>
      <TicketPass ticketId={ticketId} />
    </AuthGuard>
  );
}
