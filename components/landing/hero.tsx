"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowRight, CalendarDays, MapPin, Sparkles, Users } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { formatTime } from "@/lib/format";
import { seatState } from "@/lib/seats";
import { cn } from "@/lib/utils";
import { TRACK_LABELS } from "@/lib/types";
import type { PublicEvent } from "@/lib/events-server";
import { Reveal, WordReveal } from "@/components/motion/reveal";
import { Magnetic } from "@/components/motion/magnetic";
import { PosterField } from "@/components/landing/poster-field";
import { FieldLabel, Stub } from "@/components/ui/stub";

/** How long each featured poster holds before the next one fades in. */
const ROTATE_MS = 6000;

/**
 * The paper field: light, and the grain of the sheet itself.
 *
 * The dark hero floated three blurred colour orbs — crimson, gold, maroon — on
 * long offset cycles. That is a lighting trick, and it only works on a dark
 * ground: a coloured bloom reads as a lamp behind glass. Over paper the same
 * orbs read as stains.
 *
 * What replaces them is what actually happens to a sheet of paper: light falls
 * across it from one side, the far corner cools slightly, and the fibre itself
 * has texture. The grain is now doing real work rather than covering banding —
 * at this opacity on a near-white ground it is the difference between paper and
 * a blank div.
 *
 * `parallax` is the far plane's scroll offset. It moves furthest and slowest,
 * which is what makes the middle and foreground read as nearer.
 */
function PaperField({ parallax }: { parallax: MotionValue<number> | number }) {
  return (
    <motion.div
      aria-hidden
      style={{ y: parallax }}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Light from the top-left, the way a page sits under a window. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 12% -10%, #ffffff 0%, transparent 60%), radial-gradient(70% 60% at 95% 10%, #fdf3ea 0%, transparent 55%), radial-gradient(80% 70% at 60% 110%, #f6ece1 0%, transparent 60%)",
        }}
      />

      {/*
       * One warm accent, kept faint. Crimson at 6% on paper is a blush at the
       * edge of the sheet, not a glow — the brand touching the page rather than
       * lighting it.
       */}
      <div
        className="animate-drift-a absolute -left-[12%] -top-[18%] size-[40rem] rounded-full opacity-[0.06] blur-[120px]"
        style={{ background: "var(--ku-red)" }}
      />

      {/* The fibre. Multiply, not overlay: grain on paper darkens, it does not glow. */}
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
 * The front door.
 *
 * `featured` is fetched on the server by `app/page.tsx` rather than here. The
 * poster is the largest element above the fold, so fetching it client-side
 * would guarantee a blank frame and a late LCP on the one screen that cannot
 * afford either — and unlike the directory below, none of this is per-user, so
 * there is nothing an authenticated read would add.
 *
 * With no upcoming events the marquee is not rendered at all and the hero falls
 * back to exactly the title card it has always been.
 */
export function Hero({ featured = [] }: { featured?: PublicEvent[] }) {
  const { user } = useAuth();
  const hasFeatured = featured.length > 0;
  const reduced = useReducedMotion();

  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  /*
   * Three rates, far to near, so the hero has depth rather than sliding.
   *
   * The spread is deliberately narrow — roughly 110px between the furthest and
   * nearest plane across the whole scroll. Past that the planes stop reading as
   * one scene lit from one place and start reading as three separate things
   * moving at three speeds, which is the exact effect a parallax hero is
   * usually accused of.
   *
   * The foreground moves *against* the scroll, which is what sells it: near
   * things fall behind you more slowly than far things.
   */
  const farY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const midY = useTransform(scrollYProgress, [0, 1], [0, 44]);
  const nearY = useTransform(scrollYProgress, [0, 1], [0, -22]);

  // Bound to a literal 0 rather than a slower value: reduced motion means
  // static, not gentler.
  const far = reduced ? 0 : farY;
  const mid = reduced ? 0 : midY;
  const near = reduced ? 0 : nearY;

  return (
    <section
      ref={ref}
      className="relative flex min-h-[92dvh] items-center overflow-hidden px-5 pb-20 pt-24 sm:px-8"
    >
      <PaperField parallax={far} />

      {/*
        Real event artwork on the wall behind the headline. Renders nothing
        until at least three events have cover art, so the hero never shows
        stock imagery standing in for a campus that has not uploaded any.
      */}
      <motion.div style={{ y: far }} className="absolute inset-0">
        <PosterField events={featured} />
      </motion.div>

      {/*
        With a poster in the row the hero widens to max-w-6xl — which is also
        the header's width, so the two finally align. Without one it stays at
        max-w-5xl, exactly as before.
      */}
      <div
        className={cn(
          "relative mx-auto w-full",
          hasFeatured ? "max-w-6xl" : "max-w-5xl",
        )}
      >
        <div
          className={cn(
            "grid items-center gap-x-14 gap-y-12",
            hasFeatured && "lg:grid-cols-[minmax(0,1fr)_17rem]",
          )}
        >
          {/* The nearest plane. Moves least, and against the scroll. */}
          <motion.div style={{ y: near }}>
            <Reveal delay={0.05}>
              <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="size-3 text-ku-red" />
                Karnavati University
              </span>
            </Reveal>

            {/*
              The headline shrinks a step when a poster shares the row, or the
              composition breaks: measured in Fraunces at weight 600, the longer
              line ("on campus, in one place.") renders 10.95x the font size —
              WordReveal's per-word inline-blocks carry their trailing spaces,
              so it runs wider than the raw string measures. At the original
              clamp it overruns the narrowed column and wraps to four lines.

              5.5vw is the coefficient that keeps it on one line at the tightest
              point — a 1024px viewport, where the column is 632px and the line
              lands at 617px — and 4.5rem caps it once the container stops
              growing at 1216px. Without a poster the clamp is untouched.
            */}
            <h1
              className={cn(
                "display mt-7 max-w-4xl text-ink",
                hasFeatured
                  ? "text-[clamp(2.75rem,9vw,5.75rem)] lg:text-[clamp(2.75rem,5.5vw,4.5rem)]"
                  : "text-[clamp(2.75rem,9vw,5.75rem)]",
              )}
            >
              <WordReveal text="Everything happening" delay={0.15} />
              <br />
              <span className="text-ink-dim">
                <WordReveal text="on campus, in one place." delay={0.35} />
              </span>
            </h1>

            <Reveal delay={0.7}>
              <p className="mt-8 max-w-lg text-[17px] leading-relaxed text-ink-dim">
                Hackathons, cultural nights, workshops and everything the clubs
                dream up. Reserve a seat in two taps — your pass lives on your
                phone and the gate reads it even with no signal.
              </p>
            </Reveal>

            <Reveal delay={0.82}>
              <div className="mt-11 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="#directory"
                  className="group inline-flex h-13 items-center justify-center gap-2 rounded-full border border-border px-7 py-3.5 text-[15px] font-medium text-ink transition-colors hover:border-[color:var(--line-strong)] hover:bg-paper-sunk"
                >
                  Explore campus events
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>

                {/*
                  The one thing to do on this page. Everything else stays quiet
                  so it reads as *the* action.

                  On the dark ground this was a glowing gold gradient. Neither
                  half of that survives the move: gold is 1.34:1 on paper and
                  was dropped from the palette, and a glow is light emitted from
                  a surface — which is what a dark UI does and paper cannot.

                  So it becomes the brand red, filled and solid, sitting on the
                  sheet with a real shadow. On paper a saturated red block among
                  ink and white is already the loudest thing available; it does
                  not need help to be found.
                */}
                <Magnetic className="inline-block">
                <Link
                  href={user ? "/events/request" : "/login?next=%2Fevents%2Frequest"}
                  className="group relative inline-flex h-13 items-center justify-center gap-2 overflow-hidden rounded-full bg-ku-red px-7 py-3.5 text-[15px] font-semibold text-[#ffffff] transition-transform active:scale-[0.98]"
                  style={{
                    boxShadow:
                      "0 1px 0 0 #ffffff40 inset, 0 10px 24px -8px color-mix(in oklch, var(--ku-red) 45%, transparent)",
                  }}
                >
                  <span className="relative z-10">Organize an event</span>
                  <ArrowRight className="relative z-10 size-4 transition-transform group-hover:translate-x-0.5" />

                  {/* A slow sheen sweeps across on hover. */}
                  <motion.span
                    aria-hidden
                    initial={{ x: "-120%" }}
                    whileHover={{ x: "320%" }}
                    transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute inset-y-0 w-1/3 -skew-x-[18deg] bg-white/35 blur-md"
                  />
                </Link>
                </Magnetic>
              </div>
            </Reveal>
          </motion.div>

          {hasFeatured ? (
            <FeaturedMarquee events={featured} parallax={mid} />
          ) : null}
        </div>

        {/* Three numbers that say what the platform does, without a chart. */}
        <Reveal delay={1}>
          <dl className="mt-20 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line">
            {[
              ["Two taps", "to reserve a seat"],
              ["No signal", "needed at the gate"],
              ["One scan", "per pass, ever"],
            ].map(([value, label]) => (
              <div key={value} className="glass px-5 py-6">
                <dt className="display text-[1.35rem] text-ink sm:text-[1.6rem]">
                  {value}
                </dt>
                <dd className="mt-1.5 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-ink-soft">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * The rotating poster.
 *
 * Auto-advance stops on hover and on focus — an auto-rotating region that keeps
 * moving while someone is reading it or tabbing through it is the classic
 * carousel failure (WCAG 2.2.2), and the indicator dots give manual control
 * either way. Under `prefers-reduced-motion` the rotation never starts: the
 * featured event is still shown, it just stays put.
 */
function FeaturedMarquee({
  events,
  parallax,
}: {
  events: PublicEvent[];
  parallax: MotionValue<number> | number;
}) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced || paused || events.length < 2) return;

    const timer = setInterval(
      () => setIndex((current) => (current + 1) % events.length),
      ROTATE_MS,
    );

    return () => clearInterval(timer);
  }, [reduced, paused, events.length]);

  // The server picked these; the array never changes under us. Clamped anyway so
  // a future refetch shrinking the list cannot index off the end mid-rotation.
  const active = Math.min(index, events.length - 1);
  const event = events[active];

  return (
    <Reveal delay={0.5}>
      {/* The middle plane, between the paper field and the headline. */}
      <motion.div
        role="group"
        aria-roledescription="carousel"
        aria-label="Featured events"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        style={{ y: parallax }}
        className="mx-auto w-full max-w-[17rem] lg:mx-0"
      >
        <Stub data-theme="obsidian" className="relative overflow-hidden">
          {/* .poster carries the 2:3 ratio, so the frame has height before the
              image loads and nothing reflows underneath it. */}
          <div className="poster relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={event.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                /* .spotlight sits on the slide rather than the frame: the frame
                   is a Stub, whose ::after is already spoken for by the notch
                   treatment, and keeping the scrim inside the fading slide
                   means it cross-fades with its own image. */
                className="spotlight absolute inset-0"
              >
                {event.cover_image_url ? (
                  <Image
                    src={event.cover_image_url}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 80vw, 17rem"
                    priority={active === 0}
                    className="object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(140deg, var(--maroon) 0%, var(--ash) 60%, var(--ember) 100%)",
                    }}
                  />
                )}

                <div className="absolute inset-x-0 top-0 z-10 flex gap-2 p-4">
                  <span className="glass-strong rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-bone">
                    {TRACK_LABELS[event.track] ?? event.track}
                  </span>
                  <span className="glass-strong rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
                    {event.category}
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                  <FieldLabel>Next up</FieldLabel>

                  <Link
                    href={`/events/${event.id}`}
                    className="display mt-1.5 block text-[1.35rem] leading-tight text-bone transition-colors hover:text-crimson-lift"
                  >
                    {event.title}
                  </Link>

                  <div className="mt-2 flex flex-col gap-1 font-mono text-[10px] text-bone-dim">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3 shrink-0 text-bone-faint" />
                      {formatTime(event.starts_at)}
                    </span>
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin className="size-3 shrink-0 text-bone-faint" />
                      {event.venue}
                    </span>
                  </div>

                  <CountdownChip event={event} />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </Stub>

        {events.length > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-1">
            {events.map((entry, i) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show ${entry.title}`}
                aria-current={i === active ? "true" : undefined}
                /* Dot is 6px but the button is padded to a 28px target — the
                   visual and the tap area are not the same thing. */
                className="group/dot p-2.5"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all duration-300",
                    i === active
                      ? "w-6 bg-ku-red"
                      : "w-1.5 bg-ink-faint group-hover/dot:bg-ink-dim",
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}
      </motion.div>
    </Reveal>
  );
}

/**
 * "Starts in 2d 4h", ticking.
 *
 * Gold by default. `--urgent` only when the seat count is also low, because
 * urgency is scarcity — an event that is soon but half empty is information,
 * not pressure, and spending the alarm colour on it would leave nothing louder
 * for the one that is genuinely about to sell out.
 */
function CountdownChip({ event }: { event: PublicEvent }) {
  const [label, setLabel] = useState<string | null>(null);
  const { seatsLeft, low } = seatState(event);

  useEffect(() => {
    const tick = () => setLabel(countdownLabel(event.starts_at));

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [event.starts_at]);

  // Rendered only after mount: the server has a different "now" than the
  // browser, so emitting a countdown during SSR is a guaranteed hydration
  // mismatch. The row keeps its height so nothing shifts when it appears.
  return (
    <div className="mt-3 flex h-5 items-center gap-3">
      {label ? (
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.12em] tabular",
            low ? "text-urgent" : "text-gold",
          )}
        >
          {label}
        </span>
      ) : null}

      {low && seatsLeft !== null ? (
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-urgent tabular">
          <Users className="size-3" />
          {seatsLeft} left
        </span>
      ) : null}
    </div>
  );
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function countdownLabel(startsAt: number, now = Date.now()): string {
  const diff = startsAt - now;
  if (diff <= 0) return "Happening now";

  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  const minutes = Math.floor((diff % HOUR) / MINUTE);
  const seconds = Math.floor((diff % MINUTE) / 1000);

  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
  return `Starts in ${minutes}m ${seconds}s`;
}
