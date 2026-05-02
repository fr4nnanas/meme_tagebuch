"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import type { MapPost } from "@/lib/actions/map";

// Leaflet-Standard-Icons broken in Webpack/Next.js – manuell setzen
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

interface LeafletMapProps {
  posts: MapPost[];
}

export function LeafletMap({ posts }: LeafletMapProps) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  // Kartenmittelpunkt: Durchschnitt aller Koordinaten oder Deutschland-Mitte als Fallback
  const center =
    posts.length > 0
      ? ([
          posts.reduce((s, p) => s + p.lat, 0) / posts.length,
          posts.reduce((s, p) => s + p.lng, 0) / posts.length,
        ] as [number, number])
      : ([51.1657, 10.4515] as [number, number]);

  const zoom = posts.length > 0 ? 10 : 6;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full rounded-xl"
      // Dunkles Overlay via CSS-Filter auf die Kacheln
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MarkerClusterGroup chunkedLoading>
        {posts.map((post) => (
          <Marker key={post.id} position={[post.lat, post.lng]}>
            <Popup minWidth={200} maxWidth={260}>
              <MapPopup post={post} />
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}

interface MapPopupProps {
  post: MapPost;
}

function MapPopup({ post }: MapPopupProps) {
  const date = new Date(post.created_at).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-1.5 p-0.5">
      {post.signed_url && (
        <div className="aspect-[3/4] w-full overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.signed_url}
            alt={post.caption ?? "Meme"}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-zinc-900">
          @{post.user.username}
        </span>
        <span className="text-xs text-zinc-500">{date}</span>
        {post.caption && (
          <p className="mt-1 text-xs text-zinc-700 line-clamp-2">
            {post.caption}
          </p>
        )}
      </div>
    </div>
  );
}
