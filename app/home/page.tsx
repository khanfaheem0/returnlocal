"use client";

import * as React from "react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Bell } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const JobsMap = dynamic(
  () => import("@/components/jobs-map").then((m) => m.JobsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

export default function HomePage() {
  const me = useQuery(api.users.getMe);
  const { signOut } = useAuthActions();
  const router = useRouter();

  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [geoError, setGeoError] = React.useState<string | null>(null);

  const [radiusKm, setRadiusKm] = React.useState(10);

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

  const myOpenJobs = useQuery(api.jobs.listMyOpenJobsLimited);
  const myAllJobs = useQuery(api.jobs.listMyJobs);
  const availableJobs = useQuery(
    api.jobs.availableJobsNearby,
    coords ? { lat: coords.lat, lng: coords.lng, radiusKm } : "skip",
  );
  const notifications = useQuery(api.notifications.listForMe, { limit: 12 });
  const markAllRead = useMutation(api.notifications.markAllRead);

  const appliedBidsList = useQuery(api.bids.listMyPendingBids);
  const activeJobsList = useQuery(api.jobs.listAssignedToMe);

  const prevJobsRef = React.useRef(
    new Map<
      string,
      { status: string; deliveryCodeRequestedAt?: number | undefined }
    >(),
  );

  const [showNotifications, setShowNotifications] = React.useState(false);

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

  const [viewMode, setViewMode] = React.useState<"feed" | "map">("feed");

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface pb-32">
      {/* TopAppBar Shell */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-[#d4fffa]/80 backdrop-blur-xl shadow-[0px_40px_40px_rgba(0,53,50,0.06)]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center overflow-hidden ring-2 ring-primary-fixed ring-offset-2 ring-offset-surface-container">
            <span className="material-symbols-outlined text-primary text-2xl">person</span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Hi{me?.name ? `, ${me.name}` : ""}!</p>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
              <p className="text-xs font-medium text-on-surface-variant">
                {coords ? "Location Active" : geoError ? "No Location" : "Finding..."}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl pl-2 font-bold tracking-tight text-[#006859]">ReturnLocal</h1>
          <button
            className="p-2 ml-4 rounded-full hover:bg-[#97ece4]/50 transition-all duration-300 relative"
            onClick={() => setShowNotifications((s) => !s)}
          >
            <span className="material-symbols-outlined text-primary">notifications</span>
            {(notifications?.length ?? 0) > 0 && notifications?.some(n => !n.read) && (
              <span className="absolute top-2 right-2 size-2 rounded-full bg-error" />
            )}
          </button>
        </div>
      </header>

      <main className="pt-28 px-6 max-w-2xl mx-auto space-y-8">
        <AuthLoading>
          <div className="grid gap-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-[260px] w-full rounded-2xl" />
          </div>
        </AuthLoading>

        <Unauthenticated>
          <div className="glass-card rounded-2xl p-6 text-center space-y-4">
            <div className="text-lg font-headline font-bold">You’re not signed in.</div>
            <Button
              className="w-full three-d-button rounded-full py-6 text-lg bg-primary hover:bg-primary-dim"
              onClick={() => router.push("/signin?redirectTo=/home")}
            >
              Sign in to continue
            </Button>
          </div>
        </Unauthenticated>

        <Authenticated>
          <section className="space-y-6">
            <div className="space-y-2 animate-float-up">
              <h2 className="text-4xl font-headline font-extrabold text-on-background tracking-tight">
                Find <span className="text-primary italic">returns</span> near you.
              </h2>
              <p className="text-on-surface-variant leading-relaxed">
                {availableJobs?.length ?? 0} packages waiting for a ride in your neighborhood.
              </p>
            </div>

            {/* Quick Actions & Menu */}
            <div className="flex flex-wrap gap-2 animate-float-up" style={{ animationDelay: '0.1s' }}>
              <button className="flex items-center px-4 py-2 text-xs font-bold rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface" onClick={() => router.push("/applied-bids")}>
                Applied bids
                {appliedBidsList && appliedBidsList.length > 0 && <span className="ml-1.5 bg-error text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-4 text-center">{appliedBidsList.length}</span>}
              </button>
              <button className="flex items-center px-4 py-2 text-xs font-bold rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface" onClick={() => router.push("/active-jobs")}>
                Active Jobs
                {activeJobsList && activeJobsList.length > 0 && <span className="ml-1.5 bg-error text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-4 text-center">{activeJobsList.length}</span>}
              </button>
              <button className="flex items-center px-4 py-2 text-xs font-bold rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface" onClick={() => router.push("/all-posts")}>
                All Posts
              </button>
              <button className="px-4 py-2 text-xs font-bold rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface" onClick={() => router.push("/profile")}>Profile</button>
              <button className="px-4 py-2 text-xs font-bold rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface" onClick={() => router.refresh()}>Refresh</button>
              <button className="px-4 py-2 text-xs font-bold rounded-full bg-error-container text-on-error-container" onClick={() => void signOut()}>Sign out</button>
            </div>

            {/* Radius Slider */}
            <div className="glass-card rounded-2xl p-4 shadow-sm animate-float-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-bold text-on-surface">Search Radius</div>
                <div className="text-sm font-black text-primary bg-primary-container px-3 py-1 rounded-full">{radiusKm} km</div>
              </div>
              <input
                type="range"
                min={10}
                max={50}
                step={1}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* View Toggle */}
            <div className="flex p-1.5 bg-surface-container-high rounded-full w-fit animate-float-up" style={{ animationDelay: '0.3s' }}>
              <button
                onClick={() => setViewMode("feed")}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${viewMode === 'feed' ? 'bg-tertiary-container text-on-tertiary-container shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: viewMode === 'feed' ? "'FILL' 1" : "" }}>format_list_bulleted</span>
                Feed
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${viewMode === 'map' ? 'bg-tertiary-container text-on-tertiary-container shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: viewMode === 'map' ? "'FILL' 1" : "" }}>map</span>
                Map
              </button>
            </div>
          </section>

          {showNotifications ? (
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest/80 backdrop-blur-md p-4 shadow-lg animate-float-up mb-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-base font-headline font-bold">Notifications</div>
                <button className="text-xs font-bold text-primary hover:underline" onClick={() => void markAllRead({})}>Mark all read</button>
              </div>
              {notifications === undefined ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-sm text-on-surface-variant italic pb-2">No notifications yet.</div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto custom-scroll pr-2">
                  {notifications.map((n) => (
                    <div
                      key={n._id}
                      className={`relative rounded-xl bg-surface p-3 text-sm shadow-sm ring-1 ring-outline/10 ${n.jobId ? "cursor-pointer hover:bg-surface-variant transition-colors" : ""
                        }`}
                      onClick={() => {
                        if (n.jobId) {
                          router.push(`/jobs/${n.jobId}`);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-on-background">{n.title}</div>
                          {n.body && <div className="text-xs text-on-surface-variant mt-1">{n.body}</div>}
                        </div>
                        {!n.read && <span className="mt-1 size-2 rounded-full bg-primary-fixed" aria-hidden />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {viewMode === "feed" ? (
            <section className="grid grid-cols-1 gap-5">
              {!coords ? (
                <div className="glass-card rounded-2xl p-8 text-center text-sm font-medium text-on-surface-variant shadow-sm ring-1 ring-outline/10 animate-float-up">
                  <span className="material-symbols-outlined text-4xl mb-4 text-secondary block">location_off</span>
                  Enable location to see available jobs nearby.
                </div>
              ) : availableJobs === undefined ? (
                <div className="space-y-4">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                  ))}
                </div>
              ) : availableJobs.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center shadow-sm ring-1 ring-outline/10 animate-float-up">
                  <span className="material-symbols-outlined text-4xl mb-4 text-tertiary block">search_off</span>
                  <p className="font-bold text-on-surface">No open jobs within {radiusKm} km.</p>
                  <p className="text-sm text-on-surface-variant mt-2">Try increasing your search radius.</p>
                </div>
              ) : (
                availableJobs.map((job, idx) => (
                  <div
                    key={job._id}
                    className="glass-card rounded-2xl p-6 flex flex-col gap-6 ring-1 ring-secondary/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-pointer animate-float-up"
                    style={{ animationDelay: `${0.1 * (idx + 1)}s` }}
                    onClick={() => router.push(`/jobs/${job._id}`)}
                  >
                    <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-primary-container/20 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-500"></div>
                    <div className="flex justify-between items-start z-10">
                      <div className="flex gap-4">
                        <div className="w-14 h-14 shrink-0 rounded-2xl bg-secondary-container flex items-center justify-center text-secondary shadow-inner relative overflow-visible">
                          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>package_2</span>
                          {/* Mini badge placeholder depending on job properties */}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-headline font-bold text-lg text-on-background line-clamp-1">{job.title}</h3>
                          <p className="text-xs font-medium text-on-surface-variant flex items-center gap-1 mt-1">
                            <span className="material-symbols-outlined text-[14px]">near_me</span> {(job.totalDistanceKm ?? 0).toFixed(2)} km away
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-black text-primary">${job.offeredPay.toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-wider line-clamp-1">{job.timeWindow}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between z-10">
                      <div className="flex gap-2">
                        <span className="bg-surface-container-highest px-3 py-1 rounded-full text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter truncate max-w-[120px]">
                          {job.pickupAddress.split(',')[0]}
                        </span>
                      </div>
                      <button
                        className="bg-primary text-on-primary px-5 py-2 rounded-full text-sm font-bold shadow-md hover:bg-primary-dim transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* My open jobs glimpse */}
              {myOpenJobs && myOpenJobs.length > 0 && (
                <div className="mt-8 pt-6 border-t border-outline-variant/30 animate-float-up">
                  <h3 className="text-lg font-headline font-bold mb-4">My Posted Jobs</h3>
                  <div className="grid gap-3">
                    {myOpenJobs.map(job => (
                      <div key={job._id} className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 shadow-sm flex items-center justify-between cursor-pointer hover:bg-surface transition-colors" onClick={() => router.push(`/jobs/${job._id}`)}>
                        <div>
                          <p className="font-bold text-sm text-on-surface line-clamp-1">{job.title}</p>
                          <p className="text-xs text-on-surface-variant">{job.timeWindow}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-primary text-sm">${job.offeredPay.toFixed(2)}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-container text-secondary">{job.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="animate-float-up h-[500px] w-full mt-4 ring-1 ring-outline/10 rounded-2xl overflow-hidden shadow-inner bg-surface-container-highest">
              {coords ? (
                <JobsMap
                  coords={coords}
                  jobs={(availableJobs ?? []).map((j) => ({
                    _id: j._id,
                    lat: j.lat,
                    lng: j.lng,
                    title: j.title,
                    distanceKm: j.totalDistanceKm,
                  }))}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-sm font-bold text-on-surface-variant">
                  {geoError ? geoError : "Getting your location…"}
                </div>
              )}
            </section>
          )}

        </Authenticated>
      </main>

      {/* Floating Action Button for Posting */}
      <Authenticated>
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            className="three-d-button bg-secondary hover:bg-secondary-dim text-on-secondary px-8 py-4 rounded-full flex items-center gap-3 group"
            onClick={() => router.push("/post-job")}
          >
            <span className="material-symbols-outlined text-white font-bold group-hover:rotate-12 transition-transform">add_box</span>
            <span className="text-lg font-headline font-extrabold tracking-tight">Post Job</span>
          </button>
        </div>
      </Authenticated>
    </div>
  );
}
