"use client";

import { Toaster as Sonner, toast } from "sonner";

/**
 * KU Events runs dark-mode-first, so the toaster is pinned to the dark theme
 * rather than reading a theme provider that would never change.
 *
 * Deliberately NOT `richColors`: green and red are reserved for the gate
 * verdict, and a green toast in the corner competes with the only signal that
 * has to be unmistakable in a queue. Toasts use the surface palette and let
 * their icon carry the tone.
 */
function Toaster(props: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      closeButton
      // Long Firestore/network messages must not become a wall of text.
      toastOptions={{
        classNames: {
          toast:
            "group border border-[color:var(--line-strong)] bg-[color:var(--ash)] text-[color:var(--bone)] shadow-[0_16px_40px_-12px_#000000e6] rounded-lg",
          title: "text-[13px] font-medium",
          description:
            "text-[color:var(--bone-dim)] text-[12px] leading-relaxed line-clamp-3",
          actionButton: "bg-[color:var(--crimson)] text-[#0d0a1f]",
          cancelButton: "bg-[color:var(--ash-2)] text-[color:var(--bone-dim)]",
          closeButton:
            "bg-[color:var(--ash-2)] border-[color:var(--line-strong)] text-[color:var(--bone-dim)]",
          error: "border-[color:var(--refuse)]/35",
          success: "border-[color:var(--admit)]/35",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
