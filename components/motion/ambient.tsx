/**
 * The page's resting state: light moving slowly across paper.
 *
 * Every surface in the product is meant to be a sheet under a lamp, and a
 * sheet under a lamp is never perfectly still — the light shifts as the room
 * does. Two washes cross on 54s and 71s cycles, which share no useful factor,
 * so the composition does not visibly repeat for over an hour.
 *
 * The bar for "lively" here is deliberately low. Anything fast enough to catch
 * the eye competes with the words, and this sits behind every page in the app,
 * including forms people are trying to fill in. It should register as the page
 * being *alive* rather than as something *animating*.
 *
 * Not a client component: it renders no state and takes no props, so it stays
 * on the server and ships zero JavaScript. The motion is entirely CSS, which is
 * also what lets `prefers-reduced-motion` switch it off through the global rule
 * rather than through a hook.
 */
export function AmbientPaper() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Warm light from the upper left, the way a page sits near a window. */}
      <div
        className="absolute -left-[20%] -top-[25%] size-[70vw] rounded-full blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, #ffffff 0%, #fdf1e6 45%, transparent 70%)",
          animation: "ambient-wash-a 54s ease-in-out infinite",
        }}
      />

      {/*
       * The counterweight, cooler and lower. Without a second wash the first
       * one reads as a single blob breathing; crossing them is what makes it
       * read as light in a room.
       */}
      <div
        className="absolute -bottom-[30%] -right-[15%] size-[60vw] rounded-full blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, #f7ece0 0%, #f2e4d6 50%, transparent 72%)",
          animation: "ambient-wash-b 71s ease-in-out infinite",
        }}
      />

      {/*
       * The faintest touch of brand, drifting on the existing 26s curve.
       * Six percent: present in aggregate, invisible if you look for it.
       */}
      <div
        className="animate-drift-a absolute left-[35%] top-[20%] size-[45vw] rounded-full opacity-[0.05] blur-[150px]"
        style={{ background: "var(--ku-red)" }}
      />
    </div>
  );
}
