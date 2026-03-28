"use client";

import * as React from "react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Star, Trash2, UserRound } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  jobId: string;
};

type ProfileStats = {
  jobsDone?: number;
  jobsPostedTotal?: number;
  jobsPostedDone?: number;
  joinedAt?: number;
};

type ProfileUser = {
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  livingAddress?: string | null;
  adhaarNumber?: string | null;
  idProofUrl?: string | null;
  idSelfieUrl?: string | null;
  verified?: boolean | null;
  rating?: number | null;
};

function RatingStars({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, idx) => {
          const filled = clamped >= idx + 1 - 0.25;
          const half = clamped > idx && clamped < idx + 1;
          return (
            <Star
              key={idx}
              className="h-3.5 w-3.5"
              fill={filled || half ? "currentColor" : "none"}
              strokeWidth={1.25}
            />
          );
        })}
      </div>
      <span className="text-foreground">{clamped.toFixed(1)}</span>
    </div>
  );
}

function ProfileCard({
  title,
  userId,
  user,
  stats,
}: {
  title: string;
  userId?: string | null;
  user: ProfileUser | null;
  stats?: ProfileStats | null;
}) {
  if (!user) return null;
  const rating = user.rating ?? 0;
  return (
    <div className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <UserRound className="mt-0.5 size-4" />
        <div className="space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium">{title}</div>
            <RatingStars value={rating} />
            <span className="text-xs text-muted-foreground">{user.verified ? "ID verified" : "Not verified"}</span>
          </div>
          <div>{user.name ?? user.email ?? "Unknown"}</div>
          {user.email ? <div className="text-xs text-muted-foreground">Email: {user.email}</div> : null}
          {user.phoneNumber ? <div className="text-xs text-muted-foreground">Phone: {user.phoneNumber}</div> : null}
          {user.livingAddress ? (
            <div className="text-xs text-muted-foreground">Address: {user.livingAddress}</div>
          ) : null}
          {user.adhaarNumber ? (
            <div className="text-xs text-muted-foreground">Adhaar: {user.adhaarNumber}</div>
          ) : null}
          {user.idProofUrl ? (
            <a className="text-xs underline" href={user.idProofUrl} target="_blank">
              View ID proof
            </a>
          ) : null}
          {user.idSelfieUrl ? (
            <a className="text-xs underline" href={user.idSelfieUrl} target="_blank">
              View ID selfie
            </a>
          ) : null}
          {stats ? (
            <div className="text-xs text-muted-foreground mt-1">
              Jobs done {stats.jobsDone ?? 0} • Posted done {stats.jobsPostedDone ?? 0}/{stats.jobsPostedTotal ?? 0}
              {stats.joinedAt ? ` • Joined ${new Date(stats.joinedAt).toLocaleDateString()}` : ""}
            </div>
          ) : null}
          {userId ? (
            <div className="mt-2">
              <a className="text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-full inline-block" href={`/profile/${userId}`}>
                View Complete Profile
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function JobDetailClient({ jobId }: Props) {
  const router = useRouter();

  // Convex Ids are branded strings at type-level; runtime they are strings.
  const convexJobId = jobId as Id<"jobs">;

  const me = useQuery(api.users.getMe);
  const jobBundle = useQuery(api.jobs.getJob, { jobId: convexJobId });
  const myPendingBids = useQuery(api.bids.listMyPendingBids);

  const createBid = useMutation(api.bids.createBid);
  const acceptBid = useMutation(api.bids.acceptBid);
  const rejectBid = useMutation(api.bids.rejectBid);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const submitPickupProof = useMutation(api.handoffs.submitPickupProof);
  const deleteJob = useMutation(api.jobs.deleteJob);
  const submitRating = useMutation(api.ratings.submitRating);
  const approveCancelRequest = useMutation(api.jobs.approveCancelRequest);

  const [showAllBids, setShowAllBids] = React.useState(false);
  const bids = useQuery(
    api.bids.listBidsForJob,
    jobBundle?.job && me && jobBundle.job.senderId === me._id
      ? { jobId: convexJobId, showAll: showAllBids }
      : "skip",
  );

  const [bidMessage, setBidMessage] = React.useState("");
  const [bidAmount, setBidAmount] = React.useState("");
  const [submitting, startTransition] = React.useTransition();

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = React.useState(false);
  const [reviewScore, setReviewScore] = React.useState(0);
  const [reviewComment, setReviewComment] = React.useState("");
  const [confirmBidId, setConfirmBidId] = React.useState<Id<"bids"> | null>(null);
  const [confirmMessage, setConfirmMessage] = React.useState<string>("");

  const [pickupFile, setPickupFile] = React.useState<File | null>(null);

  const [ratingScore, setRatingScore] = React.useState("5");
  const [ratingComment, setRatingComment] = React.useState("");
  const [ratingScoreForSender, setRatingScoreForSender] = React.useState("5");
  const [ratingCommentForSender, setRatingCommentForSender] = React.useState("");

  const [pickupLabel, setPickupLabel] = React.useState<string | null>(null);
  const [dropLabel, setDropLabel] = React.useState<string | null>(null);
  const isSender = Boolean(jobBundle?.job && me && jobBundle.job.senderId === me._id);
  const isAssignedToMe = Boolean(jobBundle?.job && me && jobBundle.job.takerId === me._id);
  const myPendingBidEntry =
    myPendingBids?.find((entry) => entry.job?._id === convexJobId) ?? null;
  const dropoffProof = React.useMemo(
    () =>
      jobBundle?.handoffs
        ?.filter((h) => h.type === "dropoff")
        .sort((a, b) => b.timestamp - a.timestamp)[0],
    [jobBundle?.handoffs],
  );
  const canViewTakerProfile = Boolean(
    jobBundle?.taker && me && (isSender || jobBundle.job.takerId === me._id),
  );

  const ratings = useQuery(
    api.ratings.listForJob,
    jobBundle?.job ? { jobId: convexJobId } : "skip",
  );

  React.useEffect(() => {
    async function fetchLabels() {
      if (!jobBundle?.job) return;
      try {
        const pickupResp = await fetch(
          `/api/reverse-geocode?lat=${jobBundle.job.lat}&lng=${jobBundle.job.lng}`,
        );
        const pickupData = await pickupResp.json();
        if (pickupResp.ok && pickupData.label) setPickupLabel(pickupData.label as string);

        if (jobBundle.job.dropLat !== undefined && jobBundle.job.dropLng !== undefined) {
          const dropResp = await fetch(
            `/api/reverse-geocode?lat=${jobBundle.job.dropLat}&lng=${jobBundle.job.dropLng}`,
          );
          const dropData = await dropResp.json();
          if (dropResp.ok && dropData.label) setDropLabel(dropData.label as string);
        }
      } catch (err) {
        console.error(err);
      }
    }
    void fetchLabels();
  }, [jobBundle?.job]);

  const pickupMapsUrl = jobBundle?.job
    ? `https://www.google.com/maps/dir/?api=1&destination=${jobBundle.job.lat},${jobBundle.job.lng}`
    : null;
  const dropMapsUrl =
    jobBundle?.job?.dropLat !== undefined && jobBundle.job.dropLng !== undefined
      ? `https://www.google.com/maps/dir/?api=1&destination=${jobBundle.job.dropLat},${jobBundle.job.dropLng}`
      : null;

  async function getCurrentCoords(): Promise<{ lat: number; lng: number }> {
    return await new Promise((resolve, reject) => {
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

  async function uploadToStorage(file: File) {
    const uploadUrl = await generateUploadUrl({});
    const resp = await fetch(uploadUrl, {
      method: "POST",
      body: file,
    });
    if (!resp.ok) {
      throw new Error("Upload failed");
    }
    const data = (await resp.json()) as { storageId: Id<"_storage"> };
    return data.storageId;
  }

  return (
    <div className="flex flex-1 items-start justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Job</CardTitle>
          <CardDescription>Details and bids.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AuthLoading>
            <div className="text-sm text-muted-foreground">Loading…</div>
          </AuthLoading>

          <Unauthenticated>
            <div className="space-y-3">
              <div className="text-sm">Sign in to view and bid.</div>
              <Button className="w-full" onClick={() => router.push(`/signin?redirectTo=/jobs/${jobId}`)}>
                Sign in
              </Button>
            </div>
          </Unauthenticated>

          <Authenticated>
            {!jobBundle ? (
              <div className="text-sm text-muted-foreground">Loading job…</div>
            ) : !jobBundle.job ? (
              <div className="text-sm">Job not found.</div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-xl font-semibold">{jobBundle.job.title}</div>
                    <div className="text-sm text-muted-foreground">Status: {jobBundle.job.status}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-semibold">${jobBundle.job.offeredPay.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{jobBundle.job.timeWindow}</div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Pickup</div>
                    <div className="rounded-lg border p-3 text-sm space-y-1">
                      <div>{pickupLabel ?? jobBundle.job.pickupAddress}</div>
                      <a
                        className="inline-flex items-center gap-1 text-xs text-primary underline"
                        href={pickupMapsUrl ?? "#"}
                        target="_blank"
                      >
                        <MapPin className="size-3" /> Directions
                      </a>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Drop</div>
                    <div className="rounded-lg border p-3 text-sm space-y-1">
                      <div>{dropLabel ?? jobBundle.job.dropAddress ?? "(not provided)"}</div>
                      {dropMapsUrl ? (
                        <a
                          className="inline-flex items-center gap-1 text-xs text-primary underline"
                          href={dropMapsUrl}
                          target="_blank"
                        >
                          <MapPin className="size-3" /> Directions
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="text-sm font-medium">Description</div>
                    <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">
                      {jobBundle.job.description}
                    </div>
                  </div>
                </div>

                {jobBundle.sender && !isSender ? (
                  <ProfileCard title="Job poster" user={jobBundle.sender} stats={jobBundle.senderStats} userId={jobBundle.job.senderId} />
                ) : null}

                {canViewTakerProfile ? (
                  <ProfileCard title="Job taker" user={jobBundle.taker} stats={jobBundle.takerStats} userId={jobBundle.job.takerId} />
                ) : null}

                {isSender && jobBundle.job.cancelRequested ? (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="text-sm font-medium">Taker requested cancellation</div>
                    <div className="text-xs text-muted-foreground">
                      Approve to remove the taker and reopen the job for new bids.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              await approveCancelRequest({ jobId: convexJobId });
                              toast.success("Cancellation approved");
                              router.refresh();
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Approve failed");
                            }
                          });
                        }}
                        disabled={submitting}
                      >
                        Approve cancellation
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => router.refresh()}
                        disabled={submitting}
                      >
                        Refresh
                      </Button>
                    </div>
                  </div>
                ) : null}

                {isSender && jobBundle.job.deliveryCode ? (
                  <div className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Delivery code</div>
                      <div className="font-mono text-lg font-semibold tracking-wide">
                        {jobBundle.job.deliveryCode}
                      </div>
                    </div>
                    {dropoffProof ? (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">Dropoff photo provided by taker</div>
                        <img
                          src={dropoffProof.photoUrl}
                          alt="Dropoff proof"
                          className="w-full max-w-sm rounded-lg border"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {isSender ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">Bids</div>
                      <Button variant="secondary" onClick={() => setShowAllBids((s) => !s)}>
                        {showAllBids ? "Show ≥4.3 only" : "Show all"}
                      </Button>
                    </div>

                    {bids === undefined ? (
                      <div className="rounded-lg border p-3 text-sm text-muted-foreground">Loading bids…</div>
                    ) : bids.length === 0 ? (
                      <div className="rounded-lg border p-3 text-sm text-muted-foreground">No pending bids.</div>
                    ) : (
                      <div className="space-y-2">
                        {bids.map((entry) =>
                          entry ? (
                            <div key={entry.bid._id} className="rounded-lg border p-3 space-y-2">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="font-medium">{entry.taker?.name ?? entry.taker?.email ?? "Unknown"}</div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <RatingStars value={entry.taker?.rating ?? 0} />
                                    <span>{entry.taker?.verified ? "ID verified" : "Not verified"}</span>
                                  </div>
                                  {entry.stats ? (
                                    <div className="text-xs text-muted-foreground">
                                      Jobs done {entry.stats.jobsDone} • Posted done {entry.stats.jobsPostedDone}/{entry.stats.jobsPostedTotal} • Joined {new Date(entry.stats.joinedAt ?? Date.now()).toLocaleDateString()}
                                    </div>
                                  ) : null}
                                  {entry.taker?.livingAddress ? (
                                    <div className="text-xs text-muted-foreground">Address: {entry.taker.livingAddress}</div>
                                  ) : null}
                                  {entry.taker?.phoneNumber ? (
                                    <div className="text-xs text-muted-foreground">Phone: {entry.taker.phoneNumber}</div>
                                  ) : null}
                                {entry.taker?.adhaarNumber ? (
                                  <div className="text-xs text-muted-foreground">Adhaar: {entry.taker.adhaarNumber}</div>
                                ) : null}
                                {entry.taker?._id ? (
                                  <div className="text-xs mt-1">
                                    <a
                                      className="font-semibold text-primary hover:underline"
                                      href={`/profile/${entry.taker._id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      View profile
                                    </a>
                                  </div>
                                ) : null}
                                {entry.bid.message ? (
                                  <div className="mt-2 text-sm whitespace-pre-wrap">{entry.bid.message}</div>
                                ) : null}
                                  {entry.bid.amount !== undefined ? (
                                    <div className="mt-2 text-sm font-bold text-primary">Proposed charge: ${entry.bid.amount.toFixed(2)}</div>
                                  ) : null}
                                </div>
                                <div className="flex flex-col gap-2">
                                  {jobBundle.job.status === "open" ? (
                                    <>
                                      <Button
                                        onClick={() => {
                                          startTransition(async () => {
                                            try {
                                              const res = await acceptBid({ bidId: entry.bid._id, force: false });
                                              if (res.ok) {
                                                toast.success("Bid accepted");
                                                router.refresh();
                                                return;
                                              }
                                              if (res.requiresConfirmation) {
                                                setConfirmBidId(entry.bid._id);
                                                setConfirmMessage(res.message);
                                                setConfirmOpen(true);
                                                return;
                                              }
                                              toast.error("Could not accept bid");
                                            } catch (err) {
                                              toast.error(err instanceof Error ? err.message : "Accept failed");
                                            }
                                          });
                                        }}
                                        disabled={submitting}
                                      >
                                        Accept
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={() => {
                                          startTransition(async () => {
                                            try {
                                              await rejectBid({ bidId: entry.bid._id });
                                              toast.success("Bid rejected");
                                            } catch (err) {
                                              toast.error(err instanceof Error ? err.message : "Reject failed");
                                            }
                                          });
                                        }}
                                        disabled={submitting}
                                      >
                                        Reject
                                      </Button>
                                    </>
                                  ) : entry.bid.status === "accepted" ? (
                                    <div className="rounded-full bg-primary/10 text-primary px-3 py-1.5 text-sm font-bold text-center border border-primary/20 shadow-sm whitespace-nowrap">
                                      Assigned Tag
                                    </div>
                                  ) : entry.bid.status === "rejected" ? (
                                    <div className="rounded-full bg-destructive/10 text-destructive px-3 py-1.5 text-sm font-bold text-center border border-destructive/20 shadow-sm whitespace-nowrap">
                                      Rejected
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ) : null,
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Place a bid</div>
                    {jobBundle.job.status !== "open" ? (
                      <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                        This job is not open for bidding.
                      </div>
                    ) : isAssignedToMe ? (
                      <div className="rounded-lg border p-3 text-sm">You’re assigned to this job.</div>
                    ) : myPendingBidEntry ? (
                      <div className="space-y-2 rounded-lg border p-3 text-sm">
                        <div className="font-medium">You already have a pending bid on this job.</div>
                        <div className="text-muted-foreground">
                          View-only details of your bid are below.
                        </div>
                        <div className="rounded-lg border p-3 bg-foreground/5 space-y-1">
                          {myPendingBidEntry.bid.amount !== undefined ? (
                            <div className="text-sm font-semibold">
                              Your bid amount: ${myPendingBidEntry.bid.amount.toFixed(2)}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">No amount specified.</div>
                          )}
                          {myPendingBidEntry.bid.message ? (
                            <div className="text-sm whitespace-pre-wrap">
                              Message: {myPendingBidEntry.bid.message}
                            </div>
                          ) : null}
                          <div className="text-xs text-muted-foreground">Status: Pending</div>
                        </div>
                      </div>
                    ) : (
                      <form
                        className="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          startTransition(async () => {
                            try {
                              await createBid({
                                jobId: convexJobId,
                                message: bidMessage.trim() ? bidMessage.trim() : undefined,
                                amount: bidAmount ? Number(bidAmount) : undefined,
                              });
                              toast.success("Bid submitted");
                              setBidMessage("");
                              setBidAmount("");
                              router.push("/home");
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Bid failed");
                            }
                          });
                        }}
                      >
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="amount">
                            Charges (optional)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                            <Input
                              id="amount"
                              type="number"
                              min="0"
                              step="0.01"
                              className="pl-7"
                              value={bidAmount}
                              onChange={(e) => setBidAmount(e.target.value)}
                              disabled={submitting}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="msg">
                            Message (optional)
                          </label>
                          <Textarea
                            id="msg"
                            value={bidMessage}
                            onChange={(e) => setBidMessage(e.target.value)}
                            disabled={submitting}
                            placeholder="I can pick this up today."
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" disabled={submitting}>
                            {submitting ? "Submitting…" : "Submit bid"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => router.push("/home")}
                            disabled={submitting}
                          >
                            Back
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {isAssignedToMe && jobBundle.job.status === "assigned" ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Pickup proof</div>
                    <div className="rounded-lg border p-3 space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPickupFile(e.target.files?.[0] ?? null)}
                        disabled={submitting}
                      />
                      <Button
                        onClick={() => {
                          if (!pickupFile) {
                            toast.error("Select a pickup photo first");
                            return;
                          }
                          startTransition(async () => {
                            try {
                              const coords = await getCurrentCoords();
                              const storageId = await uploadToStorage(pickupFile);
                              await submitPickupProof({
                                jobId: convexJobId,
                                storageId,
                                gpsLat: coords.lat,
                                gpsLng: coords.lng,
                              });
                              toast.success("Pickup proof submitted");
                              setPickupFile(null);
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Upload failed");
                            }
                          });
                        }}
                        disabled={submitting}
                      >
                        Submit pickup proof
                      </Button>
                    </div>
                  </div>
                ) : null}

                {isSender && (jobBundle.job.status === "open" || jobBundle.job.status === "assigned") ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <Trash2 className="size-4" /> Delete job
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Deleting will notify bidders and remove this posting.
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await deleteJob({ jobId: convexJobId });
                            toast.success("Job deleted");
                            router.push("/home");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Delete failed");
                          }
                        });
                      }}
                      disabled={submitting}
                    >
                      Delete job
                    </Button>
                  </div>
                ) : null}

                {(jobBundle.job.confirmedAt || jobBundle.job.status === "delivered") && ratings ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Ratings</div>

                    {isSender && jobBundle.job.takerId ? (
                      (() => {
                        const already = ratings.find(
                          (r) => r.fromUserId === me?._id && r.toUserId === jobBundle.job.takerId,
                        );
                        if (already) {
                          return (
                            <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                              You already rated the taker.
                            </div>
                          );
                        }
                        return (
                          <div className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4 space-y-4">
                            <div className="text-sm font-medium">Rate the taker</div>
                            {dropoffProof ? (
                              <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">Dropoff proof</div>
                                <img
                                  src={dropoffProof.photoUrl}
                                  alt="Dropoff proof"
                                  className="w-full max-w-sm rounded-lg border"
                                />
                              </div>
                            ) : null}
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setRatingScore(star.toString())}
                                  className={`transition-transform hover:scale-110 ${Number(ratingScore) >= star ? "text-tertiary" : "text-muted-foreground/30"}`}
                                >
                                  <Star className="size-8" fill="currentColor" />
                                </button>
                              ))}
                            </div>
                            <Textarea
                              value={ratingComment}
                              onChange={(e) => setRatingComment(e.target.value.slice(0, 300))}
                              placeholder="Write your review here..."
                              disabled={submitting}
                              className="resize-none h-20 bg-background/50 border-outline-variant/30"
                            />
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-on-surface-variant">{ratingComment.length}/300</span>
                              <Button
                                onClick={() => {
                                  if (!ratingScore) {
                                    toast.error("Please select a star rating");
                                    return;
                                  }
                                  startTransition(async () => {
                                    try {
                                      await submitRating({
                                        jobId: convexJobId,
                                        toUserId: jobBundle.job.takerId!,
                                        score: Number(ratingScore),
                                        comment: ratingComment.trim() || undefined,
                                      });
                                      toast.success("Rating submitted");
                                      setRatingComment("");
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : "Rating failed");
                                    }
                                  });
                                }}
                                disabled={submitting || !ratingScore}
                                className="bg-primary text-on-primary hover:bg-primary-dim shadow-sm"
                              >
                                Submit rating
                              </Button>
                            </div>
                          </div>
                        );
                      })()
                    ) : null}

                    {isAssignedToMe ? (
                      (() => {
                        const already = ratings.find(
                          (r) => r.fromUserId === me?._id && r.toUserId === jobBundle.job.senderId,
                        );
                        if (already) {
                          return (
                            <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                              You already rated the sender.
                            </div>
                          );
                        }
                        return (
                          <div className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4 space-y-4">
                            <div className="text-sm font-medium">Rate the sender</div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setRatingScoreForSender(star.toString())}
                                  className={`transition-transform hover:scale-110 ${Number(ratingScoreForSender) >= star ? "text-tertiary" : "text-muted-foreground/30"}`}
                                >
                                  <Star className="size-8" fill="currentColor" />
                                </button>
                              ))}
                            </div>
                            <Textarea
                              value={ratingCommentForSender}
                              onChange={(e) => setRatingCommentForSender(e.target.value.slice(0, 300))}
                              placeholder="Write your review here..."
                              disabled={submitting}
                              className="resize-none h-20 bg-background/50 border-outline-variant/30"
                            />
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-on-surface-variant">{ratingCommentForSender.length}/300</span>
                              <Button
                                onClick={() => {
                                  if (!ratingScoreForSender) {
                                    toast.error("Please select a star rating");
                                    return;
                                  }
                                  startTransition(async () => {
                                    try {
                                      await submitRating({
                                        jobId: convexJobId,
                                        toUserId: jobBundle.job.senderId,
                                        score: Number(ratingScoreForSender),
                                        comment: ratingCommentForSender.trim() || undefined,
                                      });
                                      toast.success("Rating submitted");
                                      setRatingCommentForSender("");
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : "Rating failed");
                                    }
                                  });
                                }}
                                disabled={submitting || !ratingScoreForSender}
                                className="bg-primary text-on-primary hover:bg-primary-dim shadow-sm"
                              >
                                Submit rating
                              </Button>
                            </div>
                          </div>
                        );
                      })()
                    ) : null}
                  </div>
                ) : null}

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
                        router.refresh();
                      }}>
                        Skip for now
                      </Button>
                      <Button
                        onClick={() => {
                          if (!reviewScore) {
                            toast.error("Please select a star rating");
                            return;
                          }
                          startTransition(async () => {
                            try {
                              await submitRating({
                                jobId: convexJobId,
                                toUserId: jobBundle.job.takerId!,
                                score: reviewScore,
                                comment: reviewComment.trim() || undefined,
                              });
                              toast.success("Review submitted! Thank you.");
                              setReviewDialogOpen(false);
                              router.refresh();
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

                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => router.push("/home")}>
                    Back to home
                  </Button>
                </div>

                <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm acceptance</DialogTitle>
                      <DialogDescription>{confirmMessage}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (!confirmBidId) return;
                          startTransition(async () => {
                            try {
                              const res = await acceptBid({ bidId: confirmBidId, force: true });
                              if (res.ok) {
                                toast.success("Bid accepted");
                                setConfirmOpen(false);
                                router.refresh();
                                return;
                              }
                              toast.error("Could not accept bid");
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Accept failed");
                            }
                          });
                        }}
                        disabled={submitting}
                      >
                        Accept anyway
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </Authenticated>
        </CardContent>
      </Card>
    </div>
  );
}
