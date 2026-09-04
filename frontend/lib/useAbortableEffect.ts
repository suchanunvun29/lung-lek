import * as React from "react";

/**
 * Executes an async effect with an AbortController.
 * Automatically aborts any in-flight request when dependencies change or the component unmounts.
 */
export function useAbortableEffect(
  effect: (signal: AbortSignal) => Promise<void> | void,
  deps: React.DependencyList
): void {
  React.useEffect(() => {
    const controller = new AbortController();

    try {
      const result = effect(controller.signal);
      if (result && typeof result.catch === "function") {
        result.catch((error: unknown) => {
          // Swallow AbortError / cancellation cleanly
          if (
            (error instanceof DOMException && error.name === "AbortError") ||
            (error instanceof Error && (error.name === "AbortError" || error.name === "RequestAbortedError"))
          ) {
            return;
          }
          console.error("Unhandled error in useAbortableEffect:", error);
        });
      }
    } catch (error: unknown) {
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && (error.name === "AbortError" || error.name === "RequestAbortedError"))
      ) {
        return;
      }
      console.error("Unhandled error in useAbortableEffect:", error);
    }

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}