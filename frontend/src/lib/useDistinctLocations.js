import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Distinct non-empty `inventory_items.location` values for transfer/deliver forms.
 * @param {boolean} when — typically `modalOpen`
 */
export function useDistinctLocations(when) {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (!when) return undefined;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("location")
        .not("location", "is", null)
        .limit(2500);
      if (cancelled || error) return;
      const set = new Set();
      for (const row of data ?? []) {
        const v = (row.location || "").trim();
        if (v) set.add(v);
      }
      setLocations([...set].sort((a, b) => a.localeCompare(b)));
    })();
    return () => {
      cancelled = true;
    };
  }, [when]);

  return locations;
}
