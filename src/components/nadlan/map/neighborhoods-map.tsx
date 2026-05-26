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

type Props = {
  nbhs: Neighborhood[];
  cities: City[];
};

export default function NeighborhoodsMap({ nbhs, cities }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const legendRef = useRef<L.Control | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el).setView([31.5, 35], 8);
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "© Esri" },
    ).addTo(map);

    const layer = L.layerGroup().addTo(map);

    const legend = new L.Control({ position: "bottomleft" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "dense-legend");
      div.innerHTML = '<strong>₪/מ"ר (אגרגציה לפי שכונה)</strong>' +
        '<div class="dense-legend-row"><span class="dense-legend-swatch" style="background:rgb(40,180,80)"></span> נמוך</div>' +
        '<div class="dense-legend-row"><span class="dense-legend-swatch" style="background:rgb(148,113,60)"></span> בינוני</div>' +
        '<div class="dense-legend-row"><span class="dense-legend-swatch" style="background:rgb(255,50,40)"></span> גבוה</div>' +
        '<div style="margin-top:4px;color:#9ca3af;font-size:10px">גודל = שורש (כמות עסקאות)</div>';
      return div;
    };
    legend.addTo(map);

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    map.invalidateSize();

    mapRef.current = map;
    layerRef.current = layer;
    legendRef.current = legend;

    return () => {
      observer.disconnect();
      legend.remove();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      legendRef.current = null;
    };
  }, []);

  const points = useMemo(() => {
    const ppss = nbhs.map((n) => n.pps).filter((v): v is number => v != null);
    if (!ppss.length) return [];
    const lo = Math.min(...ppss);
    const hi = Math.max(...ppss);
    return nbhs
      .map((n) => {
        const city = cities[n.c];
        if (!city || city.lat == null) return null;
        // Deterministic jitter per nbh (no Math.random — keep markers stable on rerenders)
        const hash = (n.n.length * 31 + n.c * 17) % 1000;
        const seed = (Math.sin(hash) * 10000) % 1;
        const jit1 = (seed - 0.5) * 0.04;
        const jit2 = (((hash / 7) % 1) - 0.5) * 0.04;
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
          <div class="row"><span>₪/מ"ר:</span><b>${fmtCurrency(n.pps)}</b></div>
          <div class="row"><span>מ"ר ממוצע:</span><b>${n.sqm}</b></div>
          <div class="row"><span>חדרים ממוצע:</span><b>${n.r}</b></div>
        </div>`,
      );
      m.addTo(layer);
    });
  }, [points]);

  return <div ref={elRef} className="dense-nbh-map" />;
}
