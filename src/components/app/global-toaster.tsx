"use client";

import { Toaster } from "sonner";

export function GlobalToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      toastOptions={{
        style: {
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          background: "var(--background)",
          color: "var(--foreground)",
        },
      }}
    />
  );
}
