import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { ScannerConsole } from "@/components/scanner/scanner-console";

export const metadata: Metadata = {
  title: "Gate scanner",
  robots: { index: false, follow: false },
};

export default function ScannerPage() {
  return (
    <AuthGuard allowedRoles={["scanner", "organizer", "superadmin"]}>
      <ScannerConsole />
    </AuthGuard>
  );
}
