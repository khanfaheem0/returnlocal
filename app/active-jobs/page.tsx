"use client";

import * as React from "react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function ActiveJobsPage() {
  const router = useRouter();
  const { signOut } = useAuthActions();

  const me = useQuery(api.users.getMe);
  const activeJobs = useQuery(api.jobs.listAssignedToMe);

  const requestDeliveryCode = useMutation(api.jobs.requestDeliveryCode);
  const verifyDeliveryCode = useMutation(api.jobs.verifyDeliveryCode);
  const requestCancel = useMutation(api.jobs.requestCancelCode);
  const submitRating = useMutation(api.ratings.submitRating);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  const [selectedJob, setSelectedJob] = React.useState<any>(null);
  const [code, setCode] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [photoSent, setPhotoSent] = React.useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = React.useState(false);
  const [reviewScore, setReviewScore] = React.useState(0);
  const [reviewComment, setReviewComment] = React.useState("");
  const [dropoffFile, setDropoffFile] = React.useState<File | null>(null);
  const [submitting, startTransition] = React.useTransition();

  async function uploadToStorage(file: File) {
    const uploadUrl = await generateUploadUrl({});
    const resp = await fetch(uploadUrl, { method: "POST", body: file });
    if (!resp.ok) throw new Error("Upload failed");
    const data = (await resp.json()) as { storageId: Id<"_storage"> };
    return data.storageId;
  }

  function getCurrentCoords(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported in this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(new Error(err.message || "Location permission denied.")),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    });
  }

  function openDeliveryDialog(job: any) {
    setSelectedJob(job);
    setCode("");
    setDropoffFile(null);
    setPhotoSent(false);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-4xl animate-float-up">
        <CardHeader>
          <CardTitle>Active Jobs</CardTitle>
          <CardDescription>Jobs assigned to you that are still in progress.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthLoading>
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-foreground/10 bg-background/70 p-3">
                  <Skeleton className="h-4 w-1/3" />
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
                  router.push("/signin?redirectTo=/active-jobs");
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

            {activeJobs === undefined ? (
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
            ) : activeJobs.length === 0 ? (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                You have no active assignments.
              </div>
            ) : (
              <div className="space-y-2">
                {activeJobs.map((job) => (
                  <div key={job._id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="truncate font-medium">{job.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {job.status} • {job.timeWindow}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {job.pickupAddress}
                        </div>
                        {job.dropAddress ? (
                          <div className="text-xs text-muted-foreground">
                            {job.dropAddress}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 space-y-2 text-right">
                        <div className="text-sm font-medium">${job.offeredPay.toFixed(2)}</div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/jobs/${job._id}`)}
                          >
                            View job
                          </Button>
                          <Button
                            onClick={() => openDeliveryDialog(job)}
                            disabled={submitting}
                          >
                            Delivered Request
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              startTransition(async () => {
                                try {
                                  await requestCancel({ jobId: job._id });
                                  toast.success("Cancellation request sent to poster");
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Failed to request cancellation");
                                }
                              });
                            }}
                            disabled={submitting || job.cancelRequested}
                          >
                            {job.cancelRequested ? "Cancel requested" : "Cancel request"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{photoSent ? "Enter delivery code" : "Request delivery code"}</DialogTitle>
                  <DialogDescription>
                    {photoSent
                      ? "The sender has your dropoff photo. Enter the 4-digit code they shared."
                      : "Upload dropoff photo so the sender can review and share the 4-digit code."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="photo">
                    Dropoff photo
                  </label>
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setDropoffFile(e.target.files?.[0] ?? null)}
                    disabled={submitting || photoSent}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="code">
                    Code
                  </label>
                  <Input
                    id="code"
                    value={code ?? ""}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    placeholder="1234"
                    disabled={!photoSent || submitting}
                  />
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedJob) return;
                      startTransition(async () => {
                        try {
                          if (!photoSent) {
                            if (!dropoffFile) {
                              toast.error("Please upload a dropoff photo first.");
                              return;
                            }
                            const storageId = await uploadToStorage(dropoffFile);
                            const coords = await getCurrentCoords();
                            await requestDeliveryCode({
                              jobId: selectedJob._id,
                              storageId,
                              gpsLat: coords.lat,
                              gpsLng: coords.lng,
                            });
                            setPhotoSent(true);
                            toast.info("Photo sent to sender. Ask for the code.");
                            return;
                          }
                          await verifyDeliveryCode({
                            jobId: selectedJob._id,
                            code: code.trim(),
                          });
                          toast.success("Delivery confirmed.");
                          setDialogOpen(false);
                          setCode("");
                          setDropoffFile(null);
                          setPhotoSent(false);
                          setReviewScore(0);
                          setReviewComment("");
                          setReviewDialogOpen(true);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Invalid code");
                        }
                      });
                    }}
                    disabled={submitting || (photoSent && !code.trim())}
                  >
                    {photoSent ? "Submit code" : "Send photo"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Review Dialog */}
            <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
              <DialogContent className="sm:max-w-md bg-surface-container/90 backdrop-blur-xl border-none">
                <DialogHeader>
                  <DialogTitle className="text-xl font-headline font-bold text-on-surface">Leave a review</DialogTitle>
                  <DialogDescription className="text-on-surface-variant">
                    Rate your experience. Keep text under 300 characters.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewScore(star)}
                        className={`transition-transform hover:scale-110 ${reviewScore >= star ? "text-tertiary" : "text-muted-foreground/30"}`}
                      >
                        <Star className="size-10" fill="currentColor" />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Write your review here..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value.slice(0, 300))}
                    className="resize-none h-24 bg-background/50 border-outline-variant/50 focus-visible:ring-primary"
                  />
                  <div className="text-xs text-on-surface-variant self-end">
                    {reviewComment.length}/300
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => {
                    setReviewDialogOpen(false);
                    router.push("/home");
                  }}>
                    Skip for now
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedJob) return;
                      if (!reviewScore) {
                        toast.error("Please select a star rating");
                        return;
                      }
                      startTransition(async () => {
                        try {
                          await submitRating({
                            jobId: selectedJob._id,
                            toUserId: selectedJob.senderId,
                            score: reviewScore,
                            comment: reviewComment.trim() || undefined,
                          });
                          toast.success("Review submitted! Thank you.");
                          setReviewDialogOpen(false);
                          router.push("/home");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed to submit review");
                        }
                      });
                    }}
                    disabled={submitting || !reviewScore}
                    className="bg-primary text-on-primary hover:bg-primary-dim shadow-sm"
                  >
                    Submit Review
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Authenticated>
        </CardContent>
      </Card>
    </div>
  );
}
