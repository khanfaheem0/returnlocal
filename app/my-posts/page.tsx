"use client";

import * as React from "react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyPostsPage() {
  const router = useRouter();
  const { signOut } = useAuthActions();

  const me = useQuery(api.users.getMe);
  const myJobs = useQuery(api.jobs.listMyJobs);
  const deleteJob = useMutation(api.jobs.deleteJob);
  const [submitting, startTransition] = React.useTransition();

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-4xl animate-float-up">
        <CardHeader>
          <CardTitle>My posts</CardTitle>
          <CardDescription>Jobs you’ve posted as a sender.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthLoading>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm"
                >
                  <Skeleton className="h-4 w-1/2" />
                  <div className="mt-2 flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </AuthLoading>

          <Unauthenticated>
            <div className="space-y-3">
              <div className="text-sm">You’re not signed in.</div>
              <Button
                className="w-full"
                onClick={() => {
                  router.push("/signin?redirectTo=/my-posts");
                }}
              >
                Sign in
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  router.push("/home");
                }}
              >
                Back
              </Button>
            </div>
          </Unauthenticated>

          <Authenticated>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">Signed in{me?.email ? ` as ${me.email}` : ""}.</div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void signOut()}>
                  Sign out
                </Button>
                <Button variant="secondary" onClick={() => router.push("/home")}>
                  Home
                </Button>
                <Button onClick={() => router.refresh()}>Refresh</Button>
              </div>
            </div>

            {myJobs === undefined ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm"
                  >
                    <Skeleton className="h-4 w-1/2" />
                    <div className="mt-2 flex items-center gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : myJobs.length === 0 ? (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                You haven’t posted any jobs yet.
              </div>
            ) : (
              <div className="space-y-2">
                {myJobs.map((job) => (
                  <div
                    key={job._id}
                    className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{job.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {job.status} • {job.timeWindow}
                        </div>
                      </div>
                      <div className="shrink-0 text-right space-y-2">
                        <div className="text-sm font-medium">${job.offeredPay.toFixed(2)}</div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              router.push(`/jobs/${job._id}`);
                            }}
                          >
                            View
                          </Button>
                          {job.status === "open" || job.status === "assigned" ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                startTransition(async () => {
                                  try {
                                    await deleteJob({ jobId: job._id });
                                    toast.success("Job deleted");
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Delete failed");
                                  }
                                });
                              }}
                              disabled={submitting}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  router.push("/post-job");
                }}
              >
                Post a job
              </Button>
            </div>
          </Authenticated>
        </CardContent>
      </Card>
    </div>
  );
}
