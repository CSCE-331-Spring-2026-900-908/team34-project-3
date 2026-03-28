import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-stone-400",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";
