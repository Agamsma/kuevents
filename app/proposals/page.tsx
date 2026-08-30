import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { MyProposals } from "@/components/events/my-proposals";

export const metadata: Metadata = {
  title: "Your proposals",
  robots: { index: false, follow: false },
};

export default function MyProposalsPage() {
  return (
    <AuthGuard>
      <MyProposals />
    </AuthGuard>
  );
}
