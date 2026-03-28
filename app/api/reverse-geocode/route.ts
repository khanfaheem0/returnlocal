import { NextResponse } from "next/server";

export const runtime = "nodejs";

type NominatimItem = {
  display_name: string;
  lat: string;
  lon: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing lat/lng" }, { status: 400 });
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/reverse");
  nominatimUrl.searchParams.set("format", "json");
  nominatimUrl.searchParams.set("lat", lat);
  nominatimUrl.searchParams.set("lon", lng);

  const resp = await fetch(nominatimUrl.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "ReturnLocal/0.1 (dev)",
    },
    cache: "no-store",
  });

  if (!resp.ok) {
    return NextResponse.json(
      { error: `Reverse geocoding failed (${resp.status})` },
      { status: 502 },
    );
  }

  const data = (await resp.json()) as NominatimItem;

  return NextResponse.json({
    label: data.display_name,
    lat: Number(data.lat),
    lng: Number(data.lon),
  });
}
