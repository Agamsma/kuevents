import Link from "next/link";

import { TRACK_FULL_NAMES, type EventTrack } from "@/lib/types";
import { Perforation } from "@/components/ui/stub";

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-5 py-14 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            {/*
              TODO(logo): drop the reversed university emblem at
              public/ku-logo-reversed.svg, then replace the wordmark div below
              with the lockup:

                <div className="flex items-center gap-4">
                  <Image
                    src="/ku-logo-reversed.svg"
                    alt="Karnavati University"
                    width={73}
                    height={64}
                    className="h-16 w-auto"
                    priority={false}
                  />
                  <div className="display text-[1.4rem] text-bone">KU Events</div>
                </div>

              Sizing is not arbitrary. KU's guideline sets a 0.6in ≈ 58px
              minimum height for the emblem; h-16 (64px) clears it. The mark's
              own aspect is 516:450 (1.147), measured off the supplied artwork,
              so 64px tall is ~73px wide — set width auto so it is never
              squeezed. Clear space is the height of the "K" in KARNAVATI,
              which is 6.0% of the mark (27px of 450), so ≈3.8px at this size;
              the gap-4 and the footer's own py-14 exceed that many times over.

              Two constraints on the file itself:
              - It MUST be the reversed/light version. 47.2% of the supplied
                positive emblem is the #2b2a29 shield field, which measures
                1.40:1 on --obsidian — nearly half the mark disappears here.
              - If the SVG carries the same baked-in padding as the PNG (the
                mark is only 13.2% of that canvas), h-16 renders a 28px mark
                and silently breaks the minimum. Use a viewBox trimmed to the
                artwork, or raise the height to 146px to compensate.

              The footer is the right home for it: it sits below the hero, so
              it is outside AmbientField's bounds and lands on flat --obsidian
              rather than on a drifting gradient.
            */}
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
