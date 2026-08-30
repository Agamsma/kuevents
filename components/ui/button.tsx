import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-crimson text-[#0d0a1f] shadow-[0_1px_0_0_#ffffff40_inset] hover:bg-crimson/90",
        gold:
          "bg-gold text-[#211502] shadow-[0_1px_0_0_#ffffff50_inset] hover:bg-gold/90",
        destructive: "bg-refuse text-[#2a0508] hover:bg-refuse/90",
        outline:
          "border border-line bg-transparent hover:border-[color:var(--line-strong)] hover:bg-white/[0.04]",
        secondary: "bg-ash text-bone hover:bg-ash-2",
        ghost: "hover:bg-white/[0.06] text-bone-dim hover:text-bone",
        link: "text-crimson underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 text-sm has-[>svg]:px-3.5",
        sm: "h-8 rounded-sm gap-1.5 px-3 text-[13px] has-[>svg]:px-2.5",
        lg: "h-11 px-6 text-[15px] has-[>svg]:px-5",
        xl: "h-14 rounded-lg px-8 text-base has-[>svg]:px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
