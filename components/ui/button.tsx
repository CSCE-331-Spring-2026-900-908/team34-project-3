import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = {
  default: "bg-foreground text-white hover:bg-black",
  outline: "border border-border bg-white text-foreground hover:bg-[rgb(var(--muted))]",
  ghost: "bg-transparent text-foreground hover:bg-[rgb(var(--muted))]"
} as const;

const buttonSizes = {
  default: "min-h-11 px-4 py-2.5",
  sm: "min-h-9 px-3 py-2 text-sm",
  lg: "min-h-12 px-5 py-3",
  icon: "h-10 w-10"
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
