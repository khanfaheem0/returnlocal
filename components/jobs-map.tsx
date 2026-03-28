"use client";

import * as React from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

type Coords = { lat: number; lng: number };

type JobMarker = {
  _id: string;
  lat: number;
  lng: number;
  title: string;
  distanceKm: number;
};

export function JobsMap({
  coords,
  jobs,
}: {
  coords: Coords;
  jobs: JobMarker[];
}) {
  return (
    <MapContainer
      center={[coords.lat, coords.lng]}
      zoom={13}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={[coords.lat, coords.lng]}
        radius={8}
        pathOptions={{ color: "#2563eb" }}
      >
        <Popup>Your location</Popup>
      </CircleMarker>
      {jobs.map((job) => (
        <CircleMarker
          key={job._id}
          center={[job.lat, job.lng]}
          radius={7}
          pathOptions={{ color: "#16a34a" }}
        >
          <Popup>
            <div className="space-y-1">
              <div className="font-medium">{job.title}</div>
              <div className="text-xs text-muted-foreground">
                {job.distanceKm.toFixed(2)} km away
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
