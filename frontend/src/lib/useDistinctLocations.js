import { useEffect, useState } from "react";
import { supabase } from "./supabase";

let inventoryItemLocationsTableAvailable = true;

function normalizeLocation(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isMissingInventoryItemLocationsError(err) {
  const msg = String(err?.message || "").toLowerCase();
  const details = String(err?.details || "").toLowerCase();
  const code = String(err?.code || "").toLowerCase();
  return (
    msg.includes("inventory_item_locations") ||
    details.includes("inventory_item_locations") ||
    code === "pgrst205" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist")
  );
}

/**
 * Distinct non-empty locations from per-location inventory balances.
 * @param {boolean} when — typically `modalOpen`
 */
export function useDistinctLocations(when) {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (!when) return undefined;
    let cancelled = false;
    (async () => {
      const locationByKey = new Map();
      let locRes = { data: [], error: null };
      if (inventoryItemLocationsTableAvailable) {
        locRes = await supabase
          .from("inventory_item_locations")
          .select("location")
          .not("location", "is", null)
          .limit(2500);
        if (locRes.error && isMissingInventoryItemLocationsError(locRes.error)) {
          inventoryItemLocationsTableAvailable = false;
        }
      }

      // Prefer per-location inventory table when available.
      if (!locRes.error) {
        for (const row of locRes.data ?? []) {
          const v = normalizeLocation(row.location);
          if (!v) continue;
          const key = v.toLowerCase();
          if (!locationByKey.has(key)) locationByKey.set(key, v);
        }
      }

      // Include standalone locations created from Manage Locations page.
      const savedLocations = await supabase.from("locations").select("name").limit(2500);
      if (!savedLocations.error) {
        for (const row of savedLocations.data ?? []) {
          const v = normalizeLocation(row.name);
          if (!v) continue;
          const key = v.toLowerCase();
          if (!locationByKey.has(key)) locationByKey.set(key, v);
        }
      }

      // Always merge legacy locations so dropdowns stay synced in mixed environments.
      const legacy = await supabase
        .from("inventory_items")
        .select("location")
        .not("location", "is", null)
        .limit(2500);
      if (!legacy.error) {
        for (const row of legacy.data ?? []) {
          const v = normalizeLocation(row.location);
          if (!v) continue;
          const key = v.toLowerCase();
          if (!locationByKey.has(key)) locationByKey.set(key, v);
        }
      }

      // Also merge locations seen in receive entries so newly used
      // warehouse names can appear in dropdowns before stock sync.
      const receiveLocations = await supabase
        .from("receive_transaction_items")
        .select("location")
        .not("location", "is", null)
        .limit(2500);
      if (!receiveLocations.error) {
        for (const row of receiveLocations.data ?? []) {
          const v = normalizeLocation(row.location);
          if (!v) continue;
          const key = v.toLowerCase();
          if (!locationByKey.has(key)) locationByKey.set(key, v);
        }
      }

      // Merge locations seen in stock movements so screens that rely on
      // this hook (Receive/Produce/etc.) can show transfer/storage locations too.
      const movementLocations = await supabase
        .from("stock_movements")
        .select("from_location,to_location")
        .limit(2500);
      if (!movementLocations.error) {
        for (const row of movementLocations.data ?? []) {
          const from = normalizeLocation(row.from_location);
          const to = normalizeLocation(row.to_location);
          if (from) {
            const key = from.toLowerCase();
            if (!locationByKey.has(key)) locationByKey.set(key, from);
          }
          if (to) {
            const key = to.toLowerCase();
            if (!locationByKey.has(key)) locationByKey.set(key, to);
          }
        }
      }

      if (cancelled) return;
      setLocations([...locationByKey.values()].sort((a, b) => a.localeCompare(b)));
    })();
    return () => {
      cancelled = true;
    };
  }, [when]);

  return locations;
}
