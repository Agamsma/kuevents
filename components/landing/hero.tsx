"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { Reveal, WordReveal } from "@/components/motion/reveal";

/**
 * Three slow blurred orbs on long, offset cycles.
 *
 * Long durations and low opacity are the whole trick: nothing here should be
 * fast enough to catch the eye deliberately. It should register as the page
 * having depth, not as something moving.
 */
function AmbientField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="animate-drift-a absolute -left-[15%] -top-[20%] size-[42rem] rounded-full opacity-[0.22] blur-[110px]"
        style={{ background: "var(--crimson-deep)" }}
      />
      <div
        className="animate-drift-b absolute -right-[12%] top-[5%] size-[34rem] rounded-full opacity-[0.16] blur-[120px]"
        style={{ background: "var(--gold)" }}
      />
      <div
        className="animate-drift-c absolute bottom-[-25%] left-[25%] size-[38rem] rounded-full opacity-[0.18] blur-[130px]"
        style={{ background: "var(--maroon)" }}
      />

      {/* A fine grain over the gradients. Without it, large blurred fields band
          badly on 8-bit displays. */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

export function Hero() {
  const { user } = useAuth();

  return (
    <section className="relative flex min-h-[92dvh] items-center overflow-hidden px-5 pb-20 pt-24 sm:px-8">
      <AmbientField />

      <div className="relative mx-auto w-full max-w-5xl">
        <Reveal delay={0.05}>
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-bone-dim">
            <Sparkles className="size-3 text-gold" />
            Karnavati University
          </span>
        </Reveal>

        <h1 className="display mt-7 max-w-4xl text-[clamp(2.75rem,9vw,5.75rem)] text-bone">
          <WordReveal text="Everything happening" delay={0.15} />
          <br />
          <span className="text-bone-dim">
            <WordReveal text="on campus, in one place." delay={0.35} />
          </span>
        </h1>

        <Reveal delay={0.7}>
          <p className="mt-8 max-w-lg text-[17px] leading-relaxed text-bone-dim">
            Hackathons, cultural nights, workshops and everything the clubs
            dream up. Reserve a seat in two taps — your pass lives on your phone
            and the gate reads it even with no signal.
          </p>
        </Reveal>

        <Reveal delay={0.82}>
          <div className="mt-11 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="#directory"
              className="group inline-flex h-13 items-center justify-center gap-2 rounded-full border border-line px-7 py-3.5 text-[15px] font-medium text-bone transition-colors hover:border-[color:var(--line-strong)] hover:bg-white/[0.05]"
            >
              Explore campus events
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            {/* The one glowing element on the page. Everything else stays quiet
                so this reads as *the* thing to do. */}
            <Link
              href={user ? "/events/request" : "/login?next=%2Fevents%2Frequest"}
              className="group relative inline-flex h-13 items-center justify-center gap-2 overflow-hidden rounded-full px-7 py-3.5 text-[15px] font-semibold text-[#1a0207] transition-transform active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, var(--gold) 0%, #f0c977 45%, var(--gold) 100%)",
                boxShadow:
                  "0 0 0 1px #ffffff30 inset, 0 8px 30px -6px color-mix(in oklch, var(--gold) 55%, transparent)",
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
          </div>
        </Reveal>

        {/* Three numbers that say what the platform does, without a chart. */}
        <Reveal delay={1}>
          <dl className="mt-20 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line">
            {[
              ["Two taps", "to reserve a seat"],
              ["No signal", "needed at the gate"],
              ["One scan", "per pass, ever"],
            ].map(([value, label]) => (
              <div key={value} className="glass px-5 py-6">
                <dt className="display text-[1.35rem] text-bone sm:text-[1.6rem]">
                  {value}
                </dt>
                <dd className="mt-1.5 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-bone-faint">
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
