import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { AdminHome } from "@/components/admin/admin-home";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Strictly `superadmin`.
 *
 * The guard here only decides what renders — `/api/admin/users` re-checks the
 * role on every request, which is the boundary that actually holds.
 */
export default function AdminPage() {
  return (
    <AuthGuard allowedRoles={["superadmin"]}>
      <AdminHome />
    </AuthGuard>
  );
}
