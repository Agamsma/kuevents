import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { OrganizerDashboard } from "@/components/organizer-dashboard";

export const metadata: Metadata = {
  title: "Organize",
  robots: { index: false, follow: false },
};

export default function OrganizerPage() {
  return (
    <AuthGuard allowedRoles={["organizer", "superadmin"]}>
      <OrganizerDashboard />
    </AuthGuard>
  );
}
