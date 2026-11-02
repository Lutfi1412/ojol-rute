import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { PROVIDERS } from "@/constants/app";
import type { GeoPoint, ProviderId, RoutePlan } from "@/types/route.types";
import { decodePolyline } from "@/utils/polyline";
import { cn } from "@/utils/cn";

export interface MapStop {
  id: string;
  label: string;
  address: string;
  provider: ProviderId;
  latitude: number;
  longitude: number;
  visitOrder: number;
  isCompleted: boolean;
}

interface RouteMapProps {
  stops: MapStop[];
  startPoint?: GeoPoint | null;
  plan?: RoutePlan | null;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [-6.2088, 106.8456];

function buildStopIcon(provider: ProviderId, visitOrder: number, isCompleted: boolean) {
  const modifier = isCompleted ? "done" : provider;

  return L.divIcon({
    className: "bg-transparent border-0",
    html: `<span class="stop-marker stop-marker--${modifier}">${visitOrder}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const startIcon = L.divIcon({
  className: "bg-transparent border-0",
  html: '<span class="start-marker">A</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function MapViewport({ positions }: { positions: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) return;

    if (positions.length === 1) {
      const onlyPosition = positions[0];
      if (onlyPosition) map.setView(onlyPosition, 15);
      return;
    }

    map.fitBounds(L.latLngBounds(positions), { padding: [36, 36], maxZoom: 16 });
  }, [map, positions]);

  return null;
}

/** Peta Leaflet: garis rute asli (hasil Directions) + marker bernomor. */
export function RouteMap({ stops, startPoint, plan, className }: RouteMapProps) {
  const positions = useMemo<Array<[number, number]>>(() => {
    const decoded = plan ? decodePolyline(plan.polyline) : [];
    if (decoded.length > 1) {
      return decoded.map((point) => [point.latitude, point.longitude] as [number, number]);
    }

    return [
      ...(startPoint ? [[startPoint.latitude, startPoint.longitude] as [number, number]] : []),
      ...stops.map((stop) => [stop.latitude, stop.longitude] as [number, number]),
    ];
  }, [plan, startPoint, stops]);

  const center: [number, number] = startPoint
    ? [startPoint.latitude, startPoint.longitude]
    : (positions[0] ?? DEFAULT_CENTER);

  if (stops.length === 0 && !startPoint) {
    return (
      <div
        className={cn(
          "grid h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-[13px] text-ink-soft",
          className,
        )}
      >
        Peta muncul setelah ada titik yang ditambahkan.
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-line", className)}>
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        className="h-[300px] w-full sm:h-[360px]"
        attributionControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

        {positions.length > 1 ? (
          <Polyline
            positions={positions}
            pathOptions={{
              color: "#4f46e5",
              weight: 5,
              opacity: 0.85,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        ) : null}

        {startPoint ? (
          <Marker position={[startPoint.latitude, startPoint.longitude]} icon={startIcon}>
            <Tooltip direction="top" offset={[0, -12]}>
              Mulai: {startPoint.label}
            </Tooltip>
          </Marker>
        ) : null}

        {stops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.latitude, stop.longitude]}
            icon={buildStopIcon(stop.provider, stop.visitOrder, stop.isCompleted)}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              <span className="font-semibold">
                {stop.visitOrder}. {stop.label}
              </span>
              <br />
              {PROVIDERS[stop.provider].label} · {stop.address}
            </Tooltip>
          </Marker>
        ))}

        <MapViewport positions={positions} />
      </MapContainer>

      <div className="pointer-events-none absolute bottom-6 left-3 z-[500] flex gap-1.5 rounded-full bg-white/95 px-2.5 py-1.5 shadow-sm">
        {(["grab", "shopee"] as ProviderId[]).map((provider) => (
          <span
            key={provider}
            className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-slate-600"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: PROVIDERS[provider].color }}
            />
            {PROVIDERS[provider].label}
          </span>
        ))}
      </div>
    </div>
  );
}
