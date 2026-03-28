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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function RatingStars({ rating, count }: { rating: number; count?: number }) {
  if (rating === 0) return <span className="text-xs text-muted-foreground">No ratings yet</span>;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${i < Math.round(rating) ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
        >
          <path d="M12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21z" />
        </svg>
      ))}
      <span className="text-sm font-medium ml-1">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground ml-1">({count})</span>}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { signOut } = useAuthActions();

  const me = useQuery(api.users.getMe);
  const userQueryArgs = me?._id ? { userId: me._id as Id<"users"> } : "skip";
  const userPage = useQuery(api.users.getUserPage, userQueryArgs);
  const reviews = useQuery(
    api.ratings.listForUser,
    userQueryArgs === "skip" ? "skip" : { userId: (me?._id as Id<"users">) },
  );

  const updateMe = useMutation(api.users.updateMe);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const saveIdSelfie = useMutation(api.users.saveIdSelfie);
  const saveIdProof = useMutation(api.users.saveIdProof);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [avatar, setAvatar] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [livingAddress, setLivingAddress] = React.useState("");
  const [adhaarNumber, setAdhaarNumber] = React.useState("");
  const [idProof, setIdProof] = React.useState<File | null>(null);
  const [selfieUrl, setSelfieUrl] = React.useState("");
  const [selfie, setSelfie] = React.useState<File | null>(null);
  const [submitting, startTransition] = React.useTransition();
  const [selfiePreviewOpen, setSelfiePreviewOpen] = React.useState(false);

  React.useEffect(() => {
    if (!me) return;
    setName(me.name ?? "");
    setEmail(me.email ?? "");
    setAvatar(me.avatar ?? "");
    setPhoneNumber(me.phoneNumber ?? "");
    setLivingAddress(me.livingAddress ?? "");
    setAdhaarNumber(me.adhaarNumber ?? "");
    setSelfieUrl(me.selfieUrl ?? "");
  }, [me]);

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

  const reviewList = Array.isArray(reviews) ? reviews : [];
  const heroImage = (me?.idSelfieUrl as string | undefined) || userPage?.idSelfieUrl || userPage?.avatar || undefined;

  return (
    <div className="flex flex-1 items-start justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>View your reputation and edit your details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthLoading>
            <div className="text-sm text-muted-foreground">Loading…</div>
          </AuthLoading>

          <Unauthenticated>
            <div className="space-y-3">
              <div className="text-sm">You’re not signed in.</div>
              <Button
                className="w-full"
                onClick={() => {
                  router.push("/signin?redirectTo=/profile");
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
              </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="edit">Edit profile</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {userPage === undefined ? (
                  <div className="rounded-lg border p-3 text-sm text-muted-foreground">Loading profile…</div>
                ) : userQueryArgs === "skip" || userPage === null ? (
                  <div className="rounded-lg border p-3 text-sm text-muted-foreground">Profile not available.</div>
                ) : (
                  <>
                    <Card className="overflow-hidden border-none shadow-xl bg-surface-container/60 backdrop-blur-xl">
                      <div className="h-32 bg-gradient-to-r from-primary/80 to-accent/70" />
                      <CardContent className="relative pt-0 px-6 pb-6">
                        <div className="flex flex-col sm:flex-row gap-6 mt-[-48px]">
                          <button
                            type="button"
                            className="size-24 rounded-full border-4 border-background bg-surface-variant flex shrink-0 items-center justify-center overflow-hidden"
                            style={
                              heroImage ? { backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined
                            }
                            onClick={() => heroImage && setSelfiePreviewOpen(true)}
                          >
                            {!heroImage && (
                              <span className="text-3xl">
                                {(userPage.name || "U").charAt(0).toUpperCase()}
                              </span>
                            )}
                          </button>
                          <div className="pt-14 sm:pt-16 flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <h1 className="text-2xl font-headline font-bold text-on-surface">
                                  {userPage.name || "Anonymous User"}
                                </h1>
                                <div className="flex items-center gap-3 mt-1">
                                  <RatingStars rating={userPage.rating ?? 0} count={reviewList.length} />
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                    {userPage.verified ? "ID Verified" : "Not Verified"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 py-6 border-y border-outline-variant/30">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">{userPage.completedJobs}</div>
                            <div className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Jobs Done</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">{userPage.stats.jobsPostedDone}</div>
                            <div className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Posted Done</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">{userPage.stats.jobsPostedTotal}</div>
                            <div className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Total Posted</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">
                              {new Date(userPage.createdAt).getFullYear()}
                            </div>
                            <div className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Joined</div>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 mt-6">
                          <div className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm">
                            <div className="text-sm font-semibold mb-2">Contact</div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              {(me?.email ?? userPage.email) && <div>Email: {me?.email ?? userPage.email}</div>}
                              {me?.phoneNumber && <div>Phone: {me.phoneNumber}</div>}
                              {me?.livingAddress && <div>Address: {me.livingAddress}</div>}
                            </div>
                          </div>
                          <div className="rounded-lg border border-foreground/10 bg-background/70 p-3 shadow-sm">
                            <div className="text-sm font-semibold mb-2">Identity</div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              {me?.adhaarNumber && <div>Adhaar: {me.adhaarNumber}</div>}
                              {me?.idProofUrl && (
                                <a className="text-primary underline block" href={me.idProofUrl} target="_blank">
                                  View ID proof
                                </a>
                              )}
                              {me?.idSelfieUrl && (
                                <a className="text-primary underline block" href={me.idSelfieUrl} target="_blank">
                                  View ID selfie
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-3">
                      <h2 className="text-lg font-semibold">Reviews ({reviewList.length})</h2>
                      {userQueryArgs === "skip" || reviews === undefined ? (
                        <div className="rounded-lg border p-3 text-sm text-muted-foreground">Loading reviews…</div>
                      ) : reviewList.length === 0 ? (
                        <div className="rounded-lg border p-3 text-sm text-muted-foreground">No reviews yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {reviewList.map((r) => (
                            <Card key={r._id} className="bg-surface-container/50 border-none shadow-sm">
                              <CardContent className="p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                                      {(r.fromUser?.name || "A").charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="text-sm font-semibold">{r.fromUser?.name || "Anonymous"}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {new Date(r._creationTime).toLocaleDateString()}
                                      </div>
                                    </div>
                                  </div>
                                  <RatingStars rating={r.score} />
                                </div>
                                {r.comment ? (
                                  <div className="text-sm text-on-surface-variant leading-relaxed">“{r.comment}”</div>
                                ) : null}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="edit">
                <div className="space-y-3">
                  <div className="text-sm font-medium">Profile info</div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="name">
                      Name
                    </label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="email">
                      Email
                    </label>
                    <Input
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="avatar">
                      Avatar URL
                    </label>
                    <Input
                      id="avatar"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="phone">
                        Phone number
                      </label>
                      <Input
                        id="phone"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={submitting}
                        placeholder="+91..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="adhaar">
                        Adhaar number
                      </label>
                      <Input
                        id="adhaar"
                        value={adhaarNumber}
                        onChange={(e) => setAdhaarNumber(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="address">
                      Address
                    </label>
                    <Input
                      id="address"
                      value={livingAddress}
                      onChange={(e) => setLivingAddress(e.target.value)}
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">ID proof (upload)</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setIdProof(e.target.files?.[0] ?? null)}
                      disabled={submitting}
                    />
                    {me?.idProofUrl ? (
                      <div className="text-xs">
                        <a className="text-primary underline" href={me.idProofUrl} target="_blank">
                          View current ID proof
                        </a>
                      </div>
                    ) : null}
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!idProof) {
                          toast.error("Select a file first");
                          return;
                        }
                        startTransition(async () => {
                          try {
                            const storageId = await uploadToStorage(idProof);
                            const res = await saveIdProof({ storageId });
                            toast.success("ID proof uploaded");
                            if (res.idProofUrl) setIdProof(null);
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Upload failed");
                          }
                        });
                      }}
                      disabled={submitting}
                    >
                      Upload ID proof
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">ID selfie (upload)</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
                      disabled={submitting}
                    />
                    {selfieUrl ? (
                      <div className="text-xs">
                        <a className="text-primary underline" href={selfieUrl} target="_blank">
                          View current selfie
                        </a>
                      </div>
                    ) : null}
                    <Button
                      onClick={() => {
                        if (!selfie) {
                          toast.error("Select a file first");
                          return;
                        }
                        startTransition(async () => {
                          try {
                            const storageId = await uploadToStorage(selfie);
                            const res = await saveIdSelfie({ storageId });
                            setSelfieUrl(res.idSelfieUrl);
                            setSelfie(null);
                            toast.success("Selfie uploaded");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Upload failed");
                          }
                        });
                      }}
                      disabled={submitting}
                    >
                      Upload selfie
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await updateMe({
                              name,
                              email,
                              avatar,
                              phoneNumber,
                              livingAddress,
                              adhaarNumber,
                            });
                            toast.success("Profile updated");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Update failed");
                          }
                        });
                      }}
                      disabled={submitting}
                    >
                      Save
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
              </TabsContent>
            </Tabs>
            <Dialog open={selfiePreviewOpen} onOpenChange={setSelfiePreviewOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Profile selfie</DialogTitle>
                </DialogHeader>
                {heroImage ? (
                  <img src={heroImage} alt="Profile selfie" className="w-full rounded-lg object-contain" />
                ) : (
                  <div className="text-sm text-muted-foreground">No selfie uploaded.</div>
                )}
              </DialogContent>
            </Dialog>
          </Authenticated>
        </CardContent>
      </Card>
    </div>
  );
}
