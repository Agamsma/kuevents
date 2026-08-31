import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { OrganizerHome } from "@/components/dashboard/organizer-home";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <AuthGuard allowedRoles={["organizer", "superadmin"]}>
      <OrganizerHome />
    </AuthGuard>
  );
}
