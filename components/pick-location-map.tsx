"use client";

import * as React from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from "react-leaflet";

type Coords = { lat: number; lng: number };

function ClickToPick({ onPick }: { onPick: (coords: Coords) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function PickLocationMap({
  center,
  current,
  selected,
  onSelect,
}: {
  center: Coords;
  current: Coords | null;
  selected: Coords | null;
  onSelect: (coords: Coords) => void;
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickToPick onPick={onSelect} />

      {current ? (
        <CircleMarker center={[current.lat, current.lng]} radius={8} pathOptions={{ color: "#2563eb" }}>
          <Popup>Your location</Popup>
        </CircleMarker>
      ) : null}

      {selected ? (
        <CircleMarker center={[selected.lat, selected.lng]} radius={8} pathOptions={{ color: "#16a34a" }}>
          <Popup>Pinned location</Popup>
        </CircleMarker>
      ) : null}
    </MapContainer>
  );
}
