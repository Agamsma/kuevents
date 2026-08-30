import type { Metadata } from "next";

import { AuthGuard } from "@/components/auth-guard";
import { MyPasses } from "@/components/my-passes";

export const metadata: Metadata = {
  title: "Your passes",
  robots: { index: false, follow: false },
};

export default function MyPassesPage() {
  return (
    <AuthGuard>
      <MyPasses />
    </AuthGuard>
  );
}
