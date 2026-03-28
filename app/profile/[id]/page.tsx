"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function RatingStars({ rating, count }: { rating: number; count?: number }) {
    if (rating === 0) return <span className="text-xs text-muted-foreground">No ratings yet</span>;
    return (
        <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    className={`size-4 ${i < Math.round(rating) ? "fill-tertiary text-tertiary" : "text-muted-foreground/30"}`}
                />
            ))}
            <span className="text-sm font-medium ml-1">{rating.toFixed(1)}</span>
            {count !== undefined && <span className="text-xs text-muted-foreground ml-1">({count})</span>}
        </div>
    );
}

export default function PublicProfilePage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.id as Id<"users">;
    const [selfieOpen, setSelfieOpen] = React.useState(false);

    const user = useQuery(api.users.getUserPage, { userId });
    const reviews = useQuery(api.ratings.listForUser, { userId });
    const heroImage = user?.idSelfieUrl || user?.avatar;

    if (user === undefined || reviews === undefined) {
        return (
            <div className="flex flex-1 items-center justify-center p-4">
                <div className="text-sm text-muted-foreground">Loading profile...</div>
            </div>
        );
    }

    if (user === null) {
        return (
            <div className="flex flex-1 items-center justify-center p-4">
                <div className="text-sm text-muted-foreground">User not found</div>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col items-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
            <div className="w-full max-w-3xl space-y-6">
                <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                    ← Back
                </Button>

                <Card className="overflow-hidden border-none shadow-xl bg-surface-container/30 backdrop-blur-xl">
                    <div className="h-32 bg-gradient-to-r from-primary/80 to-accent/80" />
                    <CardContent className="relative pt-0 px-6 pb-6">
                        <div className="flex flex-col sm:flex-row gap-6 mt-[-48px]">
                            <button
                                type="button"
                                className="size-24 rounded-full border-4 border-background bg-surface-variant flex shrink-0 items-center justify-center overflow-hidden"
                                style={heroImage ? { backgroundImage: `url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                                onClick={() => heroImage && setSelfieOpen(true)}
                            >
                                {!heroImage && <span className="text-3xl">{(user.name || "U").charAt(0).toUpperCase()}</span>}
                            </button>
                            <div className="pt-14 sm:pt-16 flex-1">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h1 className="text-2xl font-headline font-bold text-on-surface">{user.name || "Anonymous User"}</h1>
                                        <div className="flex items-center gap-3 mt-1">
                                            <RatingStars rating={user.rating ?? 0} count={reviews.length} />
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                                {user.verified ? "ID Verified" : "Not Verified"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 py-6 border-y border-outline-variant/30">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary">{user.completedJobs}</div>
                                <div className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Jobs Done</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary">{user.stats.jobsPostedDone}</div>
                                <div className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Posted Done</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary">{user.stats.jobsPostedTotal}</div>
                                <div className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Total Posted</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary">
                                    {new Date(user.createdAt).getFullYear()}
                                </div>
                                <div className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Joined</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <Card className="bg-surface-container/50 border-none shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-sm">Contact</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground space-y-1">
                                {user.email && <div>Email: {user.email}</div>}
                                {user.phoneNumber && <div>Phone: {user.phoneNumber}</div>}
                                {user.livingAddress && <div>Address: {user.livingAddress}</div>}
                            </CardContent>
                        </Card>
                        <Card className="bg-surface-container/50 border-none shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-sm">Identity</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground space-y-1">
                                {user.adhaarNumber && <div>Adhaar: {user.adhaarNumber}</div>}
                                {user.idProofUrl && (
                                    <a className="text-primary underline block" href={user.idProofUrl} target="_blank">
                                        View ID proof
                                    </a>
                                )}
                                {user.idSelfieUrl && (
                                    <a className="text-primary underline block" href={user.idSelfieUrl} target="_blank">
                                        View ID selfie
                                    </a>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <h2 className="text-xl font-headline font-bold text-on-surface px-2">Reviews ({reviews.length})</h2>
                    {reviews.length === 0 ? (
                        <Card className="bg-surface-container/30 border-none shadow-sm">
                            <CardContent className="p-8 text-center text-on-surface-variant">
                                This user hasn&apos;t received any reviews yet.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {reviews.map((r) => (
                                <Card key={r._id} className="bg-surface-container/50 border-none shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold"
                                                    style={r.fromUser?.avatar ? { backgroundImage: `url(${r.fromUser.avatar})`, backgroundSize: 'cover' } : undefined}
                                                >
                                                    {!r.fromUser?.avatar && (r.fromUser?.name || "A").charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-on-surface">{r.fromUser?.name || "Anonymous"}</div>
                                                    <div className="text-xs text-on-surface-variant">{new Date(r._creationTime).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                            <RatingStars rating={r.score} />
                                        </div>
                                        {r.comment && (
                                            <p className="text-sm text-on-surface-variant ml-11 leading-relaxed">
                                                &ldquo;{r.comment}&rdquo;
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
                </div>
                <Dialog open={selfieOpen} onOpenChange={setSelfieOpen}>
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
        </div>
    );
}
