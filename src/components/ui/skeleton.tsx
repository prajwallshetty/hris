import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "rounded-md bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_25%,color-mix(in_oklch,var(--muted),white_65%)_50%,var(--muted)_75%)] motion-safe:animate-[shimmer-sweep_1.6s_ease-in-out_infinite] motion-reduce:bg-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
