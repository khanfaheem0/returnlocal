"use client";

import * as React from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-sm text-muted-foreground">Loading…</div>
        </div>
      }
    >
      <SignInPageInner />
    </React.Suspense>
  );
}

function SignInPageInner() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [submitting, startTransition] = React.useTransition();

  const redirectTo = searchParams.get("redirectTo") ?? "/home";

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>We’ll send a magic link to your email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthLoading>
            <div className="text-sm text-muted-foreground">Loading…</div>
          </AuthLoading>

          <Authenticated>
            <div className="space-y-3">
              <div className="text-sm">You’re already signed in.</div>
              <Button onClick={() => router.push("/home")} className="w-full">
                Continue
              </Button>
            </div>
          </Authenticated>

          <Unauthenticated>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  try {
                    const trimmed = email.trim();
                    if (!trimmed) return;

                    const result = await signIn("email", {
                      email: trimmed,
                      redirectTo,
                    });

                    if (result.signingIn) {
                      toast.success("Signed in");
                      router.push(redirectTo);
                      return;
                    }

                    toast.info("Magic link sent. Check the Convex dev logs for the link in dev.");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Sign-in failed");
                  }
                });
              }}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Sending…" : "Send magic link"}
              </Button>

              <div className="text-xs text-muted-foreground">
                <Link className="underline" href="/home">
                  Continue without signing in
                </Link>
              </div>
            </form>
          </Unauthenticated>
        </CardContent>
      </Card>
    </div>
  );
}
