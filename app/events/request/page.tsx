import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { SiteHeader } from "@/components/site-header";
import { ProposalForm } from "@/components/events/proposal-form";

export const metadata: Metadata = {
  title: "Propose an event",
};

/**
 * Open to every signed-in student — proposing is the one thing anybody can do,
 * which is the point of the workflow. Approval is where the gate is.
 */
export default function EventRequestPage() {
  return (
    <AuthGuard>
      <SiteHeader />
      <ProposalForm />
    </AuthGuard>
  );
}
