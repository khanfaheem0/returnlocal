"use client";

import * as React from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { convex } from "@/lib/convex";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}>
      <ConvexAuthProvider client={convex}>
        {children}
        <Toaster />
      </ConvexAuthProvider>
    </ThemeProvider>
  );
}
