"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowRight } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { LandingData } from "@/lib/events-server";
import { Reveal, WordReveal } from "@/components/motion/reveal";
import { Magnetic } from "@/components/motion/magnetic";
import { PosterWall } from "@/components/landing/poster-wall";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";

/**
 * The front door: a notice pinned to the campus noticeboard.
 *
 * ── The thesis ─────────────────────────────────────────────────────────────
 *
 * The hero used to be a text column with a 17rem poster beside it. On a 1216px
 * container that gave the single most interesting thing on the page — real
 * artwork for real events — about eight percent of the composition, and left
 * the other ninety-two as type on flat off-white. It read as dull because it
 * was: one accent colour, used once, on a sheet with almost nothing on it.
 *
 * So the artwork carries the page now. `PosterWall` is the board; this is the
 * notice stapled over it. The composition is the product's own object — a stub
 * with a tear line and a counterfoil — at hero scale, which is the one thing
 * this site can do that no other event site can.
 *
 * The counterfoil is the signature. On a real admission stub the small half is
 * where the live detail is printed, and that is exactly what it carries here:
 * how many events are actually on, how many schools they come from, and what is
 * next, ticking. Every number on it is read from Firestore — none of it is
 * copy, so it cannot go stale or overclaim.
 *
 * `landing` is fetched on the server by `app/page.tsx`. The board is the
 * largest element above the fold, so fetching it client-side would guarantee a
 * blank first frame on the one screen that cannot afford one.
 */
export function Hero({ landing }: { landing: LandingData }) {
  const { user } = useAuth();
  const reduced = useReducedMotion();

  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  /*
   * Two planes, not three.
   *
   * The board falls away with the scroll and the notice holds against it, which
   * is what sells one as pinned to the other. The old hero ran three rates over
   * a ~110px spread; with the wall doing the depth work, a third plane was
   * motion nobody could point at.
   *
   * Bound to a literal 0 under reduced motion: that setting means static, not
   * gentler.
   */
  const boardY = useTransform(scrollYProgress, [0, 1], [0, 96]);
  const noticeY = useTransform(scrollYProgress, [0, 1], [0, -18]);

  const board = reduced ? 0 : boardY;
  const notice = reduced ? 0 : noticeY;

  return (
    <section
      ref={ref}
      className="relative flex min-h-[94dvh] items-center overflow-hidden px-5 pb-20 pt-28 sm:px-8"
    >
      <Board parallax={board} events={landing.wall} />

      <div className="relative mx-auto w-full max-w-6xl">
        <motion.div style={{ y: notice }} className="max-w-[40rem]">
          <Reveal delay={0.05}>
            {/*
              A Stub, notched at the tear — the notice and its counterfoil, the
              same object the directory cards and the pass are. `paper-raised`
              rather than glass: this is a sheet lying on other sheets, and a
              frosted pane over paper is a material that does not exist.
            */}
            <Stub
              notched
              notchAt="calc(100% - 4.25rem)"
              className="bg-paper-raised shadow-[0_2px_4px_#1a141610,0_30px_70px_-28px_#1a141640]"
            >
              <div className="px-7 py-9 sm:px-10 sm:py-11">
                <FieldLabel>Karnavati University</FieldLabel>

                {/*
                  Set entirely in ink, both lines.

                  The second line used to be `--ink-dim` (7.16:1 — legible, but
                  visibly grey). Dimming half the headline halves the one
                  element carrying the page, and the reason to do it on the dark
                  ground was to keep bone from blooming. Ink on paper does the
                  opposite: it gains mass. Nothing needs holding back.
                */}
                <h1 className="display mt-6 text-[clamp(2.6rem,7.5vw,4.25rem)] text-ink">
                  <WordReveal text="Everything happening" delay={0.15} />
                  <br />
                  <WordReveal text="on campus." delay={0.32} />
                </h1>

                <Reveal delay={0.6}>
                  <p className="mt-7 max-w-md text-[17px] leading-relaxed text-ink-dim">
                    Reserve a seat in two taps. Your pass lives on your phone,
                    and the gate reads it with no signal at all.
                  </p>
                </Reveal>

                <Reveal delay={0.72}>
                  {/*
                    `items-start` matters in the column layout. Without it the
                    children stretch full-width, and the secondary link — which
                    centres its own contents — sat centred on a phone while the
                    button beside it, wrapped in an inline-block, stayed left.
                  */}
                  <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    {/*
                      The one action on this page. Everything around it stays
                      quiet so it reads as *the* thing to do — which is why the
                      board is washed out behind the notice rather than left at
                      full strength: a saturated red block has to be the loudest
                      mark in its neighbourhood to work, and on a sheet of ink
                      and white it is.
                    */}
                    <Magnetic className="inline-block">
                      <Link
                        href={
                          user
                            ? "/events/request"
                            : "/login?next=%2Fevents%2Frequest"
                        }
                        className="group relative inline-flex h-13 items-center justify-center gap-2 overflow-hidden rounded-full bg-ku-red px-7 py-3.5 text-[15px] font-semibold text-[#ffffff] transition-transform active:scale-[0.98]"
                        style={{
                          boxShadow:
                            "0 1px 0 0 #ffffff40 inset, 0 10px 24px -8px color-mix(in oklch, var(--ku-red) 45%, transparent)",
                        }}
                      >
                        <span className="relative z-10">Organize an event</span>
                        <ArrowRight className="relative z-10 size-4 transition-transform group-hover:translate-x-0.5" />

                        <motion.span
                          aria-hidden
                          initial={{ x: "-120%" }}
                          whileHover={{ x: "320%" }}
                          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
                          className="absolute inset-y-0 w-1/3 -skew-x-[18deg] bg-white/35 blur-md"
                        />
                      </Link>
                    </Magnetic>

                    <Link
                      href="#directory"
                      className="group inline-flex h-13 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium text-ink transition-colors hover:bg-paper-sunk"
                    >
                      See what&rsquo;s on
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </Reveal>
              </div>

              <Perforation className="mx-7 sm:mx-10" />

              <Counterfoil landing={landing} />
            </Stub>
          </Reveal>
        </motion.div>
      </div>
    </section>
  );
}

/** The board, on its own plane so it falls away behind the notice. */
function Board({
  parallax,
  events,
}: {
  parallax: MotionValue<number> | number;
  events: LandingData["wall"];
}) {
  return (
    <motion.div
      aria-hidden
      style={{ y: parallax }}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/*
        No light wash here. <AmbientPaper> is already doing exactly that across
        every paper page, and now that its stacking context is fixed it is
        actually visible — a second copy scoped to the hero would double the
        gradient and leave a seam where the section ends.

        The grain stays local: it is the fibre of the sheet the board is pasted
        to, and at this opacity it is the difference between paper and a blank
        div. The dark hero's three drifting colour orbs are gone for good — a
        bloom reads as a lamp behind glass, and over paper it reads as a stain.
      */}
      <PosterWall events={events} />

      <div
        className="absolute inset-0 opacity-[0.055] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </motion.div>
  );
}

/**
 * The small half of the stub: what is actually on, right now.
 *
 * Every value here is read from Firestore rather than written as copy. The
 * hero it replaced carried three slogans in glass tiles — "Two taps", "No
 * signal", "One scan" — which said what the product does in the abstract and
 * were equally true of an empty campus. A count is a claim that has to be
 * earned, and it is the thing a student actually wants to know.
 */
function Counterfoil({ landing }: { landing: LandingData }) {
  const next = landing.wall[0];

  // An empty board is an invitation, not an apology. Nobody needs telling that
  // a calendar is empty — they need telling what to do about it.
  if (!next) {
    return (
      <div className="flex min-h-[4.25rem] items-center px-7 sm:px-10">
        <p className="text-[13px] text-ink-dim">
          Nothing on the calendar yet.{" "}
          <Link
            href="/events/request"
            className="font-medium text-ku-red underline underline-offset-4"
          >
            Propose the first event
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[4.25rem] flex-wrap items-center gap-x-5 gap-y-2 px-7 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft sm:px-10">
      <Stat value={landing.upcoming} label={landing.upcoming === 1 ? "event on" : "events on"} />
      <Rule />
      <Stat value={landing.schools} label={landing.schools === 1 ? "school" : "schools"} />
      <Rule />

      <Link
        href={`/events/${next.id}`}
        className="group flex min-w-0 items-center gap-2 transition-colors hover:text-ink"
      >
        <span className="shrink-0 text-ink-faint">Next</span>
        <span className="truncate font-sans text-[12px] normal-case tracking-normal text-ink">
          {next.title}
        </span>
        <Countdown startsAt={next.starts_at} />
      </Link>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[15px] tracking-normal text-ink tabular">{value}</span>
      {label}
    </span>
  );
}

function Rule() {
  return <span aria-hidden className="h-3 w-px shrink-0 bg-[color:var(--line-strong)]" />;
}

/**
 * The one thing on the page that moves by itself.
 *
 * Rendered only after mount: the server's "now" and the browser's differ, so
 * emitting a countdown during SSR is a guaranteed hydration mismatch. The slot
 * holds its width from the surrounding flex row, so nothing shifts when it
 * arrives.
 */
function Countdown({ startsAt }: { startsAt: number }) {
  // Urgency is derived in the tick rather than at render. `Date.now()` in a
  // render body is an impure read — two renders in the same commit can disagree
  // — and here it would also have been a second, unsynchronised clock from the
  // one that produced the label beside it.
  const [now, setNow] = useState<{ label: string; urgent: boolean } | null>(null);

  useEffect(() => {
    const tick = () =>
      setNow({
        label: countdownLabel(startsAt),
        // Red only once it is today. A countdown reading four days out is
        // information; spending the alarm colour on it leaves nothing louder
        // for the one that starts in an hour.
        urgent: startsAt - Date.now() < DAY,
      });

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startsAt]);

  if (!now) return null;

  return (
    <span className={cn("shrink-0 tabular", now.urgent ? "text-ku-red" : "text-ink-soft")}>
      {now.label}
    </span>
  );
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function countdownLabel(startsAt: number, now = Date.now()): string {
  const diff = startsAt - now;
  if (diff <= 0) return "now";

  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  const minutes = Math.floor((diff % HOUR) / MINUTE);
  const seconds = Math.floor((diff % MINUTE) / 1000);

  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m ${seconds}s`;
}
