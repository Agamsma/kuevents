import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        /*
         * Every variant reads the alias layer, never the obsidian tokens
         * directly, so one button renders correctly on both grounds. It used to
         * hardcode `bg-ash` / `text-bone`, which put a near-black button on the
         * paper login card — the same class of bug `.stub` had before it was
         * pointed at `--card`.
         */
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_0_#ffffff40_inset] hover:bg-primary/90",
        /*
         * "The single most important action on this screen." On obsidian that
         * is gold; on paper gold does not exist — KU Yellow is 1.34:1 there and
         * was dropped from the palette — so it falls back to the brand red,
         * which carries the same meaning on that ground.
         */
        gold:
          "bg-gold text-[#211502] shadow-[0_1px_0_0_#ffffff50_inset] hover:bg-gold/90 [[data-theme=paper]_&]:bg-primary [[data-theme=paper]_&]:text-primary-foreground [[data-theme=paper]_&]:hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-transparent hover:border-[color:var(--line-strong)] hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "hover:bg-accent text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
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
