"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 8,
  variant = "default",
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  variant?: "default" | "end";
}) {
  const pinnedToEnd = variant === "end";

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        {...props}
        align={pinnedToEnd ? "end" : align}
        side={pinnedToEnd ? "left" : "bottom"}
        sideOffset={pinnedToEnd ? 0 : sideOffset}
        avoidCollisions={!pinnedToEnd}
        className={cn(
          "z-50 rounded-3xl bg-popover text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-hidden duration-200",
          "dark:ring-foreground/10",
          pinnedToEnd
            ? [
                "flex flex-col overflow-hidden p-0",
                "h-[calc(100vh-2rem)] w-[min(calc(100vw-2rem),36rem)]",
                "!fixed !inset-y-4 !right-4 !left-auto !translate-x-0 !translate-y-0",
                "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-right-8",
                "data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-right-8",
              ]
            : [
                "origin-(--radix-popover-content-transform-origin)",
                "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
                "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              ],
          className,
        )}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
