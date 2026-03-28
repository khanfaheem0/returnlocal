"use client";

import * as React from "react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppliedBidsPage() {
  const router = useRouter();

  const bids = useQuery(api.bids.listMyPendingBids);
  const withdrawBid = useMutation(api.bids.withdrawBid);

  const [submitting, startTransition] = React.useTransition();

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-4xl animate-float-up">
        <CardHeader>
          <CardTitle>Applied bids</CardTitle>
          <CardDescription>Pending bids you have placed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthLoading>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm">
                  <Skeleton className="h-4 w-1/2" />
                  <div className="mt-2 flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-24" />
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
                  router.push("/signin?redirectTo=/applied-bids");
                }}
              >
                Sign in
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => router.push("/home")}>Back</Button>
            </div>
          </Unauthenticated>

          <Authenticated>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
              <div className="text-sm">Manage your pending bids.</div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => router.push("/home")}>Home</Button>
              </div>
            </div>

            {bids === undefined ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm">
                    <Skeleton className="h-4 w-1/2" />
                    <div className="mt-2 flex items-center gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : bids.length === 0 ? (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">You have no pending bids.</div>
            ) : (
              <div className="space-y-2">
                {bids.map(({ bid, job }) => (
                  <div
                    key={bid._id}
                    className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="truncate font-medium">{job?.title ?? "(Job removed)"}</div>
                        <div className="text-xs text-muted-foreground">
                          {job?.timeWindow ?? ""} {job ? `• ${job.pickupAddress}` : ""}
                        </div>
                        {bid.message ? (
                          <div className="text-sm text-muted-foreground">{bid.message}</div>
                        ) : null}
                      </div>
                      <div className="shrink-0 space-y-2 text-right">
                        {job ? (
                          <div className="text-sm font-medium">${job.offeredPay.toFixed(2)}</div>
                        ) : null}
                        <div className="flex gap-2 justify-end">
                          {job ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => router.push(`/jobs/${job._id}`)}
                            >
                              View job
                            </Button>
                          ) : null}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              startTransition(async () => {
                                try {
                                  await withdrawBid({ bidId: bid._id });
                                  toast.success("Bid withdrawn");
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Withdraw failed");
                                }
                              });
                            }}
                            disabled={submitting}
                          >
                            Cancel request
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Authenticated>
        </CardContent>
      </Card>
    </div>
  );
}
