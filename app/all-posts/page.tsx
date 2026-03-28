"use client";

import * as React from "react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function AllPostsPage() {
  const router = useRouter();
  const { signOut } = useAuthActions();

  const me = useQuery(api.users.getMe);
  const deleteJob = useMutation(api.jobs.deleteJob);
  const approveCancelRequest = useMutation(api.jobs.approveCancelRequest);

  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [geoError, setGeoError] = React.useState<string | null>(null);
  const [radiusKm, setRadiusKm] = React.useState(10);
  const [submitting, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setGeoError(err.message || "Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  const myOpenJobs = useQuery(api.jobs.listMyOpenJobs);
  const liveAssignments = useQuery(api.jobs.listLiveAssignments);
  const liveFromOthers = useQuery(
    api.jobs.listLiveFromOthers,
    coords ? { lat: coords.lat, lng: coords.lng, radiusKm } : "skip",
  );
  const myAllJobs = useQuery(api.jobs.listMyJobs);

  const prevJobsRef = React.useRef(
    new Map<
      string,
      { status: string; deliveryCodeRequestedAt?: number | undefined }
    >(),
  );

  React.useEffect(() => {
    if (!myAllJobs) return;

    const prev = prevJobsRef.current;
    for (const job of myAllJobs) {
      const prevEntry = prev.get(job._id);
      if (prevEntry && prevEntry.status !== "delivered" && job.status === "delivered") {
        toast.success(`Your item "${job.description}" has been delivered successfully.`);
      }

      if (
        job.deliveryCode &&
        job.deliveryCodeRequestedAt &&
        (!prevEntry || prevEntry.deliveryCodeRequestedAt !== job.deliveryCodeRequestedAt)
      ) {
        toast.info(`Delivery code for "${job.title}": ${job.deliveryCode}`);
      }
    }

    prevJobsRef.current = new Map(
      myAllJobs.map((job) => [
        job._id,
        {
          status: job.status,
          deliveryCodeRequestedAt: job.deliveryCodeRequestedAt ?? undefined,
        },
      ]),
    );
  }, [myAllJobs]);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-5xl animate-float-up">
        <CardHeader>
          <CardTitle>All Posts</CardTitle>
          <CardDescription>Monitor your live jobs and nearby opportunities.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AuthLoading>
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </AuthLoading>

          <Unauthenticated>
            <div className="space-y-3">
              <div className="text-sm">You’re not signed in.</div>
              <Button
                className="w-full"
                onClick={() => {
                  router.push("/signin?redirectTo=/all-posts");
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

            <Tabs defaultValue="my-live" className="w-full">
              <TabsList>
                <TabsTrigger value="my-live">
                  My Live Posted
                  {myOpenJobs && myOpenJobs.length > 0 && <span className="ml-1.5 bg-error text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-4 text-center">{myOpenJobs.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="assignments">
                  Live Assignments
                  {liveAssignments && liveAssignments.length > 0 && <span className="ml-1.5 bg-error text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-4 text-center">{liveAssignments.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="others">
                  Live from Others
                  {liveFromOthers && liveFromOthers.length > 0 && <span className="ml-1.5 bg-error text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-4 text-center">{liveFromOthers.length}</span>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="my-live" className="space-y-3">
                {myOpenJobs === undefined ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm"
                      >
                        <Skeleton className="h-4 w-1/2" />
                        <div className="mt-2 flex items-center gap-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-8 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : myOpenJobs.length === 0 ? (
                  <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                    You have no open jobs.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myOpenJobs.map((job) => (
                      <div
                        key={job._id}
                        className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="truncate font-medium">{job.title}</div>
                            <div className="text-xs text-muted-foreground">{job.timeWindow}</div>
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
              </TabsContent>

              <TabsContent value="assignments" className="space-y-3">
                {liveAssignments === undefined ? (
                  <div className="space-y-2">
                    {[0, 1].map((i) => (
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
                ) : liveAssignments.length === 0 ? (
                  <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                    No live assignments right now.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {liveAssignments.map((job) => (
                      <div
                        key={job._id}
                        className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="truncate font-medium">{job.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {job.status} • {job.timeWindow}
                            </div>
                            {job.cancelCodeRequestedAt ? (
                              <div className="text-xs text-amber-600">Cancellation requested by taker</div>
                            ) : null}
                            {job.deliveryCode ? (
                              <div className="mt-2 mb-2 inline-flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 border border-primary/20 shadow-sm">
                                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Delivery Code:</span>
                                <span className="text-xl font-black text-primary tracking-widest">{job.deliveryCode}</span>
                              </div>
                            ) : null}
                          </div>
                          <div className="shrink-0 text-right space-y-2">
                            <div className="text-sm font-medium">${job.offeredPay.toFixed(2)}</div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  router.push(`/jobs/${job._id}`);
                                }}
                              >
                                View
                              </Button>
                              {job.cancelCodeRequestedAt ? (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    startTransition(async () => {
                                      try {
                                        await approveCancelRequest({ jobId: job._id });
                                        toast.success("Cancellation approved");
                                        router.refresh();
                                      } catch (err) {
                                        toast.error(err instanceof Error ? err.message : "Approve failed");
                                      }
                                    });
                                  }}
                                  disabled={submitting}
                                >
                                  Approve cancel
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="others" className="space-y-3">
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm">Radius</div>
                    <div className="text-sm font-medium">{radiusKm} km</div>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={50}
                    step={1}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground">
                    Updates the list in real-time.
                  </div>
                </div>

                {!coords ? (
                  <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                    {geoError ? geoError : "Enable location to see nearby jobs."}
                  </div>
                ) : liveFromOthers === undefined ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm"
                      >
                        <Skeleton className="h-4 w-1/2" />
                        <div className="mt-3 flex items-center justify-between">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-8 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : liveFromOthers.length === 0 ? (
                  <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                    No open jobs from other people within {radiusKm} km.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {liveFromOthers.map((job) => (
                      <div
                        key={job._id}
                        className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="truncate font-medium">{job.title}</div>
                              <div className="text-xs text-muted-foreground">{job.timeWindow}</div>
                            </div>
                            <div className="shrink-0 text-right space-y-2">
                              <div className="text-sm font-medium">${job.offeredPay.toFixed(2)}</div>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  router.push(`/jobs/${job._id}`);
                                }}
                              >
                                View
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-end justify-between text-xs text-muted-foreground">
                            <div>{(job.totalDistanceKm ?? 0).toFixed(2)} km total</div>
                            <div className="truncate text-right">{job.pickupAddress}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Authenticated>
        </CardContent>
      </Card>
    </div>
  );
}
