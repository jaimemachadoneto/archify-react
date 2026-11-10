import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// Status badges keep the text in the foreground colour and put the status
// colour in the dot and a light tint, so the text is readable in both modes.
const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold text-foreground before:size-1.5 before:rounded-full before:content-['']",
  {
    variants: {
      variant: {
        neutral: "bg-muted before:bg-muted-foreground",
        success: "bg-success/15 before:bg-success",
        warning: "bg-warning/20 before:bg-warning",
        destructive: "bg-destructive/15 before:bg-destructive",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
