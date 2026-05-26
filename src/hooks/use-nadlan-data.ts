"use client";

import { useEffect, useState } from "react";
import pako from "pako";

import type { NadlanData } from "@/types/nadlan";

const DATA_URL = "/nadlan/data.v1.json.gz";

let cache: Promise<NadlanData> | null = null;

function loadNadlanData(): Promise<NadlanData> {
  if (!cache) {
    cache = fetch(DATA_URL)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch nadlan data: ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
      })
      .then((bytes) => pako.ungzip(bytes, { to: "string" }))
      .then((text) => JSON.parse(text) as NadlanData)
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

export function useNadlanData() {
  const [data, setData] = useState<NadlanData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    loadNadlanData().then(
      (d) => {
        if (active) setData(d);
      },
      (e: unknown) => {
        if (active) setError(e instanceof Error ? e : new Error(String(e)));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return { data, error, loading: !data && !error };
}
