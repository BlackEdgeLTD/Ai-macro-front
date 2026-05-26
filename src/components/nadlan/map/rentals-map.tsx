"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";

import type { RentNeighborhoodGeo } from "@/types/nadlan";

import { fmtCurrency } from "../shared/formatters";

const COLOR_SCALE: { max: number; color: string; label: string }[] = [
  { max: 3000, color: "#10b981", label: "עד 3,000" },
  { max: 4500, color: "#84cc16", label: "3,000–4,500" },
  { max: 6000, color: "#eab308", label: "4,500–6,000" },
  { max: 7500, color: "#f97316", label: "6,000–7,500" },
  { max: 9000, color: "#dc2626", label: "7,500–9,000" },
  { max: Infinity, color: "#7f1d1d", label: "9,000+" },
];

function colorFor(price: number | null | undefined): string {
  if (price == null) return "#9ca3af";
  for (const c of COLOR_SCALE) if (price < c.max) return c.color;
  return "#7f1d1d";
}

type Props = {
  neighborhoods: RentNeighborhoodGeo[];
  roomLabel: string;
};

export default function RentalsMap({ neighborhoods, roomLabel }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const legendRef = useRef<L.Control | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el).setView([31.5, 35], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);

    const legend = new L.Control({ position: "bottomleft" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "dense-legend");
      div.innerHTML =
        "<strong>שכירות חודשית (₪)</strong>" +
        COLOR_SCALE.map(
          (c) =>
            `<div class="dense-legend-row"><span class="dense-legend-swatch" style="background:${c.color}"></span> ${c.label}</div>`,
        ).join("");
      return div;
    };
    legend.addTo(map);

    mapRef.current = map;
    layerRef.current = layer;
    legendRef.current = legend;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    map.invalidateSize();

    return () => {
      observer.disconnect();
      legend.remove();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      legendRef.current = null;
    };
  }, []);

  const valid = useMemo(
    () => neighborhoods.filter((n) => n.lat != null && n.lon != null && n.price != null),
    [neighborhoods],
  );

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!valid.length) return;

    valid.forEach((n) => {
      const m = L.circleMarker([n.lat, n.lon], {
        radius: 7,
        fillColor: colorFor(n.price),
        color: "white",
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.85,
      });
      m.bindTooltip(
        `<strong>${n.n || ""}</strong><br>${n.c || ""}<br>${roomLabel}: ${fmtCurrency(n.price)}/חודש`,
        { sticky: true },
      );
      m.addTo(layer);
    });

    if (valid.length > 0 && valid.length < 500) {
      const bounds = L.latLngBounds(valid.map((n) => [n.lat, n.lon] as [number, number]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [valid, roomLabel]);

  return (
    <div
      ref={elRef}
      className="h-full w-full"
      style={{ minHeight: 380 }}
    />
  );
}
