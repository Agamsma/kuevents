import Link from "next/link";

import { TRACK_FULL_NAMES, type EventTrack } from "@/lib/types";
import { Perforation } from "@/components/ui/stub";

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-5 py-14 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <div className="display text-[1.4rem] text-bone">KU Events</div>
            <p className="mt-2.5 text-sm leading-relaxed text-bone-dim">
              Event passes and gate check-in for Karnavati University.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-10 gap-y-2.5">
            {[
              ["Browse events", "/"],
              ["Propose an event", "/events/request"],
              ["My passes", "/tickets"],
              ["Sign in", "/login"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-faint transition-colors hover:text-bone"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <Perforation className="my-9" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {(Object.keys(TRACK_FULL_NAMES) as EventTrack[]).map((track) => (
              <span
                key={track}
                className="font-mono text-[9px] uppercase tracking-[0.12em] text-bone-faint"
                title={TRACK_FULL_NAMES[track]}
              >
                {track}
              </span>
            ))}
          </div>

          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-bone-faint">
            kuevents.in
          </span>
        </div>
      </div>
    </footer>
  );
}
