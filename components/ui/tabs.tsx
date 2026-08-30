"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "glass inline-flex items-center gap-1 rounded-full p-1.5",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A tab whose active state is a shared layout pill.
 *
 * The pill is one element that animates between triggers via framer-motion's
 * `layoutId`, so switching tabs slides rather than blinks. Render `<TabsPill />`
 * inside whichever trigger is currently active — exactly one at a time, which
 * is what gives framer-motion something to animate between.
 */
function TabsTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-faint transition-colors",
        "hover:text-bone-dim data-[state=active]:text-bone",
        className,
      )}
      {...props}
    >
      {/* Rendered only for the active tab, so exactly one pill exists at a
          time — which is what lets framer-motion animate it between them. */}
      <span className="relative z-10">{children}</span>
    </TabsPrimitive.Trigger>
  );
}

/** The sliding pill. Render inside a trigger when it is the active one. */
function TabsPill({ layoutId = "tab-pill" }: { layoutId?: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="absolute inset-0 rounded-full bg-crimson/15 ring-1 ring-inset ring-crimson/30"
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsPill };
