import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { SiteHeader } from "@/components/site-header";
import { ApprovalBoard } from "@/components/dashboard/approval-board";

export const metadata: Metadata = {
  title: "Event requests",
  robots: { index: false, follow: false },
};

export default function RequestsPage() {
  return (
    <AuthGuard allowedRoles={["organizer", "superadmin"]}>
      <SiteHeader />
      <ApprovalBoard />
    </AuthGuard>
  );
}
