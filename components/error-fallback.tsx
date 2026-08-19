"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorFallback({
  title = "Something went wrong",
  description = "The assistant hit an unexpected error. You can try again without losing your place.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <h1 className="font-heading text-2xl font-medium tracking-tight">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button type="button" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
