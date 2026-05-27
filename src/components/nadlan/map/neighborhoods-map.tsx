"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";

import type { City, Neighborhood } from "@/types/nadlan";

import { fmtCurrency, fmtNum } from "../shared/formatters";

function colorScale(v: number, lo: number, hi: number): string {
  const t = hi === lo ? 0.5 : Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  const r = Math.round(40 + t * 215);
  const g = Math.round(180 - t * 130);
  const b = Math.round(80 - t * 40);
  return `rgb(${r},${g},${b})`;
}

function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — deterministic, well-distributed PRNG. Same seed -> same sequence,
// so a given neighborhood always lands at the same jittered position.
function seededRng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Props = {
  nbhs: Neighborhood[];
  cities: City[];
};

export default function NeighborhoodsMap({ nbhs, cities }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el).setView([31.5, 34.95], 7);
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "© Esri" },
    ).addTo(map);

    const layer = L.layerGroup().addTo(map);

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    map.invalidateSize();

    mapRef.current = map;
    layerRef.current = layer;

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  const points = useMemo(() => {
    const ppss = nbhs.map((n) => n.pps).filter((v): v is number => v != null);
    if (!ppss.length) return [];
    const lo = Math.min(...ppss);
    const hi = Math.max(...ppss);
    // Seeded jitter — same neighborhood always lands at the same spot, but
    // mulberry32's distribution is much more uniform than the source's
    // Math.random()*0.04 (which also produces a ~±2km spread around the city
    // centre, but isn't repeatable).
    return nbhs
      .map((n) => {
        const city = cities[n.c];
        if (!city || city.lat == null) return null;
        const rng = seededRng(strHash(`${n.n}|${n.c}`));
        const jit1 = (rng() - 0.5) * 0.04;
        const jit2 = (rng() - 0.5) * 0.04;
        return {
          n,
          city,
          lat: city.lat + jit1,
          lon: city.lon + jit2,
          color: colorScale(n.pps, lo, hi),
          radius: Math.max(4, Math.sqrt(n.cnt) / 2),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [nbhs, cities]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    points.forEach(({ n, city, lat, lon, color, radius }) => {
      const m = L.circleMarker([lat, lon], {
        radius,
        fillColor: color,
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7,
      });
      m.bindPopup(
        `<div class="dense-popup">
          <b>${n.n}</b><br>
          <div class="row"><span>עיר:</span><b>${city.n}</b></div>
          <div class="row"><span>עסקאות:</span><b>${fmtNum(n.cnt)}</b></div>
          <div class="row"><span>מחיר ממוצע:</span><b>${fmtCurrency(n.avg)}</b></div>
          <div class="row"><span>₪/מ״ר:</span><b>${fmtCurrency(n.pps)}</b></div>
          <div class="row"><span>מ״ר ממוצע:</span><b>${n.sqm}</b></div>
          <div class="row"><span>חדרים ממוצע:</span><b>${n.r}</b></div>
        </div>`,
      );
      m.addTo(layer);
    });
  }, [points]);

  return <div ref={elRef} className="dense-nbh-map" />;
}
