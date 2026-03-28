import { NextResponse } from "next/server";

export const runtime = "nodejs";

type NominatimItem = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!q) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
  nominatimUrl.searchParams.set("format", "json");
  nominatimUrl.searchParams.set("q", q);
  nominatimUrl.searchParams.set("limit", "5");

  const resp = await fetch(nominatimUrl.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": "ReturnLocal/0.1 (dev)",
    },
    // Keep this simple; Next will cache by default in some contexts.
    cache: "no-store",
  });

  if (!resp.ok) {
    return NextResponse.json(
      { error: `Geocoding failed (${resp.status})` },
      { status: 502 },
    );
  }

  const data = (await resp.json()) as NominatimItem[];

  const results = data.map((item) => ({
    placeId: item.place_id,
    label: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));

  return NextResponse.json({ results });
}
