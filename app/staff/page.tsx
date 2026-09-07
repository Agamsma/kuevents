import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { OrganizerHome } from "@/components/dashboard/organizer-home";

export const metadata: Metadata = {
  title: "Staff console",
  robots: { index: false, follow: false },
};

/**
 * The staff console.
 *
 * Moved here from `/dashboard` so the student header can stop carrying staff
 * links entirely. The guard decides what renders; `requireCaller()` and
 * `firestore.rules` decide what the data does, and neither changed.
 */
export default function StaffConsolePage() {
  return (
    <AuthGuard allowedRoles={["organizer", "superadmin"]}>
      <OrganizerHome />
    </AuthGuard>
  );
}
