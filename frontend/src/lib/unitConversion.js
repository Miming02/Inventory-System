import { supabase } from "./supabase";

function normUnit(u) {
  return String(u || "").trim();
}

/**
 * Convert quantity for a specific item using DB conversion rules.
 * Prefers item-specific conversions, falls back to global conversions.
 */
export async function convertItemQuantity({ itemId, qty, fromUnit, toUnit }) {
  const nQty = Number(qty);
  const f = normUnit(fromUnit);
  const t = normUnit(toUnit);

  if (!itemId) throw new Error("Missing itemId for unit conversion.");
  if (!Number.isFinite(nQty)) throw new Error("Invalid qty for unit conversion.");
  if (!f || !t) throw new Error("Both fromUnit and toUnit are required.");
  if (f.toLowerCase() === t.toLowerCase()) return nQty;

  const { data, error } = await supabase.rpc("convert_item_quantity", {
    p_item_id: itemId,
    p_qty: nQty,
    p_from_unit: f,
    p_to_unit: t,
  });

  if (error) {
    throw new Error(error.message || "Unit conversion failed.");
  }

  const out = Number(data);
  if (!Number.isFinite(out)) {
    throw new Error("Unit conversion returned invalid value.");
  }
  return out;
}

