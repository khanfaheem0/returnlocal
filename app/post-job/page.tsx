"use client";

import * as React from "react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import dynamic from "next/dynamic";

import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const PickLocationMap = dynamic(
  () => import("@/components/pick-location-map").then((m) => m.PickLocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

type GeocodeResponse = {
  results: Array<{ placeId: number; label: string; lat: number; lng: number }>;
  error?: string;
};

type Coords = { lat: number; lng: number };
type LocationMode = "address" | "current" | "pin";

export default function PostJobPage() {
  const router = useRouter();
  const createJob = useMutation(api.jobs.createJob);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [pickupAddress, setPickupAddress] = React.useState("");
  const [dropAddress, setDropAddress] = React.useState("");
  const [timeWindow, setTimeWindow] = React.useState("");
  const [offeredPay, setOfferedPay] = React.useState("10");

  const [pickupMode, setPickupMode] = React.useState<LocationMode>("address");
  const [dropMode, setDropMode] = React.useState<LocationMode>("address");

  const [currentCoords, setCurrentCoords] = React.useState<Coords | null>(null);
  const [geoError, setGeoError] = React.useState<string | null>(null);

  const [pickupResolvedLatLng, setPickupResolvedLatLng] = React.useState<Coords | null>(null);
  const [pickupPickedLatLng, setPickupPickedLatLng] = React.useState<Coords | null>(null);

  const [dropResolvedLatLng, setDropResolvedLatLng] = React.useState<Coords | null>(null);
  const [dropPickedLatLng, setDropPickedLatLng] = React.useState<Coords | null>(null);

  const [submitting, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setGeoError(err.message || "Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  async function geocode(address: string, setResolved: (coords: Coords | null) => void) {
    const resp = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
    const data = (await resp.json()) as GeocodeResponse;
    if (!resp.ok) {
      throw new Error(data.error || "Geocoding failed");
    }
    if (!data.results?.length) {
      throw new Error("No matches found for that address");
    }
    const best = data.results[0];
    setResolved({ lat: best.lat, lng: best.lng });
    return best;
  }

  function applyMode(which: "pickup" | "drop", mode: LocationMode) {
    if (which === "pickup") {
      setPickupMode(mode);
      setPickupResolvedLatLng(null);
    } else {
      setDropMode(mode);
      setDropResolvedLatLng(null);
    }

    if (mode === "current") {
      if (!currentCoords) {
        toast.error(geoError ?? "Enable location to use your current location.");
        return;
      }
      if (which === "pickup") setPickupPickedLatLng({ ...currentCoords });
      else setDropPickedLatLng({ ...currentCoords });
      return;
    }

    if (mode === "pin") {
      if (!currentCoords) {
        toast.error(geoError ?? "Enable location to pin on the map.");
        return;
      }
      if (which === "pickup") {
        setPickupPickedLatLng((prev) => prev ?? { ...currentCoords });
      } else {
        setDropPickedLatLng((prev) => prev ?? { ...currentCoords });
      }
      return;
    }

    // address
    if (which === "pickup") setPickupPickedLatLng(null);
    else setDropPickedLatLng(null);
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-2xl animate-float-up">
        <CardHeader>
          <CardTitle>Post a job</CardTitle>
          <CardDescription>Create a local return job near you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthLoading>
            <div className="text-sm text-muted-foreground">Loading…</div>
          </AuthLoading>

          <Unauthenticated>
            <div className="space-y-3">
              <div className="text-sm">Sign in to post a job.</div>
              <Button
                className="w-full"
                onClick={() => {
                  router.push("/signin?redirectTo=/post-job");
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
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  try {
                    const trimmedTitle = title.trim();
                    const trimmedDesc = description.trim();
                    const trimmedPickupAddress = pickupAddress.trim();
                    const trimmedDropAddress = dropAddress.trim();
                    const trimmedWindow = timeWindow.trim();

                    if (!trimmedTitle || !trimmedDesc || !trimmedWindow) {
                      toast.error("Please fill all fields.");
                      return;
                    }

                    const pay = Number(offeredPay);
                    if (!Number.isFinite(pay) || pay <= 0) {
                      toast.error("Offered pay must be a positive number.");
                      return;
                    }

                    let pickupLat: number;
                    let pickupLng: number;
                    let finalPickupAddress = trimmedPickupAddress;

                    if (pickupMode === "address") {
                      if (!trimmedPickupAddress) {
                        toast.error("Please enter a pickup address.");
                        return;
                      }
                      const geo = await geocode(trimmedPickupAddress, setPickupResolvedLatLng);
                      pickupLat = geo.lat;
                      pickupLng = geo.lng;
                    } else {
                      const picked =
                        pickupPickedLatLng ?? (pickupMode === "current" ? currentCoords : null);
                      if (!picked) {
                        toast.error(geoError ?? "Enable location to choose a pickup point.");
                        return;
                      }
                      pickupLat = picked.lat;
                      pickupLng = picked.lng;
                      if (!finalPickupAddress) {
                        finalPickupAddress =
                          pickupMode === "pin" ? "Pinned pickup location" : "Current pickup location";
                      }
                    }

                    let dropLat: number;
                    let dropLng: number;
                    let finalDropAddress = trimmedDropAddress;

                    if (dropMode === "address") {
                      if (!trimmedDropAddress) {
                        toast.error("Please enter a drop address.");
                        return;
                      }
                      const geo = await geocode(trimmedDropAddress, setDropResolvedLatLng);
                      dropLat = geo.lat;
                      dropLng = geo.lng;
                    } else {
                      const picked = dropPickedLatLng ?? (dropMode === "current" ? currentCoords : null);
                      if (!picked) {
                        toast.error(geoError ?? "Enable location to choose a drop point.");
                        return;
                      }
                      dropLat = picked.lat;
                      dropLng = picked.lng;
                      if (!finalDropAddress) {
                        finalDropAddress =
                          dropMode === "pin" ? "Pinned drop location" : "Current drop location";
                      }
                    }

                    const jobId = await createJob({
                      title: trimmedTitle,
                      description: trimmedDesc,
                      pickupAddress: finalPickupAddress,
                      dropAddress: finalDropAddress,
                      timeWindow: trimmedWindow,
                      offeredPay: pay,
                      lat: pickupLat,
                      lng: pickupLng,
                      dropLat,
                      dropLng,
                    });

                    toast.success("Job posted");
                    router.push("/home");
                    void jobId;
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to post job");
                  }
                });
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm font-medium">Pickup location</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={pickupMode === "address" ? "default" : "secondary"}
                      disabled={submitting}
                      onClick={() => applyMode("pickup", "address")}
                    >
                      Type address
                    </Button>
                    <Button
                      type="button"
                      variant={pickupMode === "current" ? "default" : "secondary"}
                      disabled={submitting}
                      onClick={() => applyMode("pickup", "current")}
                    >
                      Use current location
                    </Button>
                    <Button
                      type="button"
                      variant={pickupMode === "pin" ? "default" : "secondary"}
                      disabled={submitting}
                      onClick={() => applyMode("pickup", "pin")}
                    >
                      Pin on map
                    </Button>
                  </div>

                  {pickupMode !== "address" ? (
                    <div className="text-xs text-muted-foreground">
                      {pickupMode === "pin"
                        ? "Click the map to pick a pinned pickup point."
                        : "We’ll use your current GPS location."}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="title">
                    Title
                  </label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={submitting}
                    placeholder="Return an online order"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="desc">
                    Description
                  </label>
                  <Textarea
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={submitting}
                    placeholder="What needs to be returned, any instructions, etc."
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="addr">
                    Pickup address
                  </label>
                  <Input
                    id="addr"
                    value={pickupAddress}
                    onChange={(e) => {
                      setPickupAddress(e.target.value);
                      setPickupResolvedLatLng(null);
                    }}
                    disabled={submitting}
                    placeholder="123 Main St, City"
                  />
                  {pickupResolvedLatLng ? (
                    <div className="text-xs text-muted-foreground">
                      Resolved to: {pickupResolvedLatLng.lat.toFixed(5)}, {pickupResolvedLatLng.lng.toFixed(5)}
                    </div>
                  ) : null}

                  {pickupMode === "current" && currentCoords ? (
                    <div className="text-xs text-muted-foreground">
                      Current: {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                    </div>
                  ) : null}

                  {pickupMode === "pin" && pickupPickedLatLng ? (
                    <div className="text-xs text-muted-foreground">
                      Pinned: {pickupPickedLatLng.lat.toFixed(5)}, {pickupPickedLatLng.lng.toFixed(5)}
                    </div>
                  ) : null}
                </div>

                {pickupMode === "pin" ? (
                  <div className="space-y-2 md:col-span-2">
                    <div className="h-[320px] overflow-hidden rounded-lg border">
                      {currentCoords ? (
                        <PickLocationMap
                          center={pickupPickedLatLng ?? currentCoords}
                          current={currentCoords}
                          selected={pickupPickedLatLng}
                          onSelect={(coords) => setPickupPickedLatLng(coords)}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                          {geoError ? geoError : "Getting your location…"}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm font-medium">Drop location</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={dropMode === "address" ? "default" : "secondary"}
                      disabled={submitting}
                      onClick={() => applyMode("drop", "address")}
                    >
                      Type address
                    </Button>
                    <Button
                      type="button"
                      variant={dropMode === "current" ? "default" : "secondary"}
                      disabled={submitting}
                      onClick={() => applyMode("drop", "current")}
                    >
                      Use current location
                    </Button>
                    <Button
                      type="button"
                      variant={dropMode === "pin" ? "default" : "secondary"}
                      disabled={submitting}
                      onClick={() => applyMode("drop", "pin")}
                    >
                      Pin on map
                    </Button>
                  </div>

                  {dropMode !== "address" ? (
                    <div className="text-xs text-muted-foreground">
                      {dropMode === "pin"
                        ? "Click the map to pick a pinned drop point."
                        : "We’ll use your current GPS location."}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="drop">
                    Drop address
                  </label>
                  <Input
                    id="drop"
                    value={dropAddress}
                    onChange={(e) => {
                      setDropAddress(e.target.value);
                      setDropResolvedLatLng(null);
                    }}
                    disabled={submitting}
                    placeholder="Drop-off address (where the job is completed)"
                  />

                  {dropResolvedLatLng ? (
                    <div className="text-xs text-muted-foreground">
                      Resolved to: {dropResolvedLatLng.lat.toFixed(5)}, {dropResolvedLatLng.lng.toFixed(5)}
                    </div>
                  ) : null}

                  {dropMode === "current" && currentCoords ? (
                    <div className="text-xs text-muted-foreground">
                      Current: {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                    </div>
                  ) : null}

                  {dropMode === "pin" && dropPickedLatLng ? (
                    <div className="text-xs text-muted-foreground">
                      Pinned: {dropPickedLatLng.lat.toFixed(5)}, {dropPickedLatLng.lng.toFixed(5)}
                    </div>
                  ) : null}
                </div>

                {dropMode === "pin" ? (
                  <div className="space-y-2 md:col-span-2">
                    <div className="h-[320px] overflow-hidden rounded-lg border">
                      {currentCoords ? (
                        <PickLocationMap
                          center={dropPickedLatLng ?? currentCoords}
                          current={currentCoords}
                          selected={dropPickedLatLng}
                          onSelect={(coords) => setDropPickedLatLng(coords)}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                          {geoError ? geoError : "Getting your location…"}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="window">
                    Time window
                  </label>
                  <Input
                    id="window"
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value)}
                    disabled={submitting}
                    placeholder="Today 2–5pm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="pay">
                    Offered pay (USD)
                  </label>
                  <Input
                    id="pay"
                    inputMode="decimal"
                    value={offeredPay}
                    onChange={(e) => setOfferedPay(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Posting…" : "Post job"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => {
                    router.push("/home");
                  }}
                >
                  Cancel
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                In dev, magic links are printed to the Convex dev logs.
              </div>
            </form>
          </Authenticated>
        </CardContent>
      </Card>
    </div>
  );
}
