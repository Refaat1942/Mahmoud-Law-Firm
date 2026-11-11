import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-muted text-muted-foreground",
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
      success: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
      warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
      danger: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
      accent: "bg-accent/20 text-accent-foreground dark:text-accent",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type Tone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Colour used for each enum value across the app. */
export const STATUS_TONES: Record<string, Tone> = {
  OPEN: "info",
  ON_HOLD: "warning",
  CLOSED: "neutral",
  SCHEDULED: "info",
  HELD: "success",
  POSTPONED: "warning",
  CANCELLED: "neutral",
  TODO: "neutral",
  IN_PROGRESS: "info",
  DONE: "success",
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
  DRAFT: "neutral",
  SUBMITTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
  DECLINED: "danger",
  BILLED: "accent",
  ISSUED: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  SENT: "info",
  ACCEPTED: "success",
  CONVERTED: "accent",
  PENDING: "warning",
  CLEARED: "success",
  BOUNCED: "danger",
  ACTIVE: "success",
  ON_LEAVE: "warning",
  TERMINATED: "neutral",
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
  LEAVE: "info",
  REMOTE: "info",
  WON: "success",
  LOST: "danger",
  SETTLED: "accent",
  PARTIAL: "warning",
  VALID: "success",
  EXPIRING: "warning",
  EXPIRED: "danger",
  DEPOSIT: "success",
  WITHDRAWAL: "warning",
  APPLIED: "info",
  REFUND: "neutral",
};
