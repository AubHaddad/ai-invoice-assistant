"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorFallback onRetry={retry} />;
}
