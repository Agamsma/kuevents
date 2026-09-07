import Image from "next/image";

/**
 * The university's marks.
 *
 * Deliberately capped in size, because of what the artwork actually is. The
 * only lockup available is a 200×241 raster; the 1024px crest in `public/` is
 * PNG colour type 2 with **no alpha channel**, so it carries a baked white
 * background and renders as a white box on the paper ground. Neither can be
 * shown large.
 *
 * So the mark appears at sizes this raster genuinely supports and never larger.
 * The spec's "emblem large, like a seal" treatment — the login seal, the hero
 * mark resolving out of light — is blocked until a real vector arrives from
 * KU's brand team. When it does, this is the only file that changes.
 */

/** Native pixel dimensions of `ku-lockup.png`. Above this it visibly softens. */
const LOCKUP_W = 200;
const LOCKUP_H = 241;

/**
 * Where the flame ends and the wordmark begins, in the source artwork.
 *
 * The lockup is the mark stacked over "KARNAVATI UNIVERSITY". At navbar size
 * that type is what turns to mud — the flame itself is a simple silhouette and
 * survives being small perfectly well. Cropping to this fraction is what lets
 * the emblem sit in the header at all.
 */
const FLAME_H = 166;

/**
 * The flame alone, for the header.
 *
 * Cropped with `overflow-hidden` rather than a second exported asset, so there
 * is still exactly one piece of KU artwork in the repo to swap when the real
 * vector arrives.
 *
 * `alt=""` on purpose: the wordmark beside it already says "KU Events", and a
 * screen reader announcing the university twice in one link is noise.
 */
export function MarkGlyph({
  size = 30,
  className,
}: {
  /** Rendered height of the flame, in pixels. */
  size?: number;
  className?: string;
}) {
  const scale = size / FLAME_H;

  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "block",
        overflow: "hidden",
        width: Math.round(LOCKUP_W * scale),
        height: size,
        flexShrink: 0,
      }}
    >
      <Image
        src="/ku-lockup.png"
        alt=""
        width={LOCKUP_W}
        height={LOCKUP_H}
        priority
        style={{
          width: Math.round(LOCKUP_W * scale),
          height: Math.round(LOCKUP_H * scale),
          maxWidth: "none",
        }}
      />
    </span>
  );
}

/** The vertical lockup: flame, peacock, wordmark. */
export function Mark({
  size = 96,
  className,
  priority = false,
}: {
  /** Rendered height in pixels. Clamped to the artwork's native height. */
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  // Clamped here rather than left to a caller, who cannot see the artwork and
  // has no way to know where it starts to blur.
  const height = Math.min(size, LOCKUP_H);
  const width = Math.round((height / LOCKUP_H) * LOCKUP_W);

  return (
    <Image
      src="/ku-lockup.png"
      alt="Karnavati University"
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}

/**
 * NAAC A+ accreditation.
 *
 * Belongs in the footer, and optionally a landing page closing band — never the
 * header, where it competes with the wordmark for the same job and the page
 * ends up with two things claiming to be the identity.
 *
 * Sits on a white plate, always. The artwork sets "NAAC GRADE" and "ACCREDITED
 * UNIVERSITY" in black and is built for white backgrounds; dropped straight
 * onto the obsidian footer, the wordmark vanishes and all that survives is the
 * flame and a floating "A+". A plate is also what print does with an
 * accreditation mark on a dark masthead, so it is the honest fix rather than a
 * workaround — and it means one component works on either ground.
 */
export function NaacMark({ className }: { className?: string }) {
  return (
    <span
      // `bg-[#ffffff]`, not `bg-white`: this project's `@theme inline` block
      // redefines the colour namespace, so Tailwind's default `white` key does
      // not resolve and `bg-white` silently produces no background at all.
      className={
        "inline-flex items-center rounded-md bg-[#ffffff] px-2.5 py-1.5 " +
        (className ?? "")
      }
    >
      <Image
        src="/ku-naac.webp"
        alt="NAAC Grade A+ accredited university"
        width={300}
        height={100}
        className="h-full w-auto"
      />
    </span>
  );
}
