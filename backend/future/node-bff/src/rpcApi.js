import { pool } from "./db.js";
import { randomUUID } from "node:crypto";

const columnCache = new Map();

async function hasColumn(client, tableName, columnName) {
  const key = `${tableName}.${columnName}`;
  if (columnCache.has(key)) return columnCache.get(key);
  const { rows } = await client.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName]
  );
  const exists = rows.length > 0;
  columnCache.set(key, exists);
  return exists;
}

async function resolveOrgId(client, payload) {
  if (payload?.organization_id) return payload.organization_id;
  let { rows } = await client.query("SELECT id FROM public.organizations ORDER BY created_at ASC LIMIT 1");
  if (!rows.length) {
    const id = randomUUID();
    await client.query(
      "INSERT INTO public.organizations (id, name, slug, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
      [id, "Default organization", "default"]
    );
    rows = [{ id }];
  }
  return rows[0].id;
}

async function convertItemQuantity(client, params) {
  const itemId = params?.p_item_id;
  const qty = Number(params?.p_qty ?? 0);
  const fromUnit = String(params?.p_from_unit || "").trim().toLowerCase();
  const toUnit = String(params?.p_to_unit || "").trim().toLowerCase();
  const organizationId = await resolveOrgId(client, params);

  if (!Number.isFinite(qty)) throw new Error("Invalid quantity");
  if (!fromUnit || !toUnit) throw new Error("from_unit and to_unit are required");
  if (fromUnit === toUnit) return qty;

  const itemHasFactor = await hasColumn(client, "item_unit_conversions", "factor");
  const itemFactorCol = itemHasFactor ? "factor" : "multiplier";
  const globalHasFactor = await hasColumn(client, "unit_conversions", "factor");
  const globalFactorCol = globalHasFactor ? "factor" : "multiplier";

  const itemResult = await client.query(
    `SELECT ${itemFactorCol} AS factor FROM public.item_unit_conversions
     WHERE item_id = $1 AND organization_id = $2
       AND lower(from_unit) = $3
       AND lower(to_unit) = $4
     LIMIT 1`,
    [itemId, organizationId, fromUnit, toUnit]
  );
  if (itemResult.rows.length) return qty * Number(itemResult.rows[0].factor);

  const globalResult = await client.query(
    `SELECT ${globalFactorCol} AS factor FROM public.unit_conversions
     WHERE organization_id = $1
       AND lower(from_unit) = $2
       AND lower(to_unit) = $3
     LIMIT 1`,
    [organizationId, fromUnit, toUnit]
  );
  if (globalResult.rows.length) return qty * Number(globalResult.rows[0].factor);

  throw new Error(`No conversion factor from "${fromUnit}" to "${toUnit}" for item ${itemId}`);
}

async function processStockAdjustmentReview(client, params) {
  const adjustmentId = params?.p_adjustment_id;
  const action = String(params?.p_action || "").trim().toLowerCase();
  const reviewNotes = String(params?.p_review_notes || "").trim() || null;
  const actorId = params?.p_actor_id || null;
  if (!["approve", "reject"].includes(action)) throw new Error("invalid action");

  const { rows } = await client.query(
    "SELECT * FROM public.stock_adjustments WHERE id = $1 FOR UPDATE",
    [adjustmentId]
  );
  if (!rows.length) throw new Error("stock adjustment not found");
  const adj = rows[0];
  if (!["pending", "draft"].includes(String(adj.status || "").toLowerCase())) {
    throw new Error("stock adjustment already processed");
  }

  if (action === "approve") {
    let location = (adj.requested_location || "").trim();
    if (!location) {
      const m = String(adj.reason || "").match(/Location:\s*([^|]+)/i);
      location = m?.[1]?.trim() || "";
    }
    if (!location) throw new Error("requested location is required to approve disposal");

    await client.query(
      `INSERT INTO public.stock_movements
       (item_id, movement_type, reference_type, reference_id, quantity, from_location, to_location, notes, created_by, organization_id)
       VALUES ($1, 'out', 'disposal', $2, $3, $4, NULL, $5, $6, $7)`,
      [
        adj.item_id,
        adj.id,
        adj.quantity,
        location,
        `Approved disposal ${adj.adjustment_number}${reviewNotes ? `: ${reviewNotes}` : ""}`,
        actorId,
        adj.organization_id,
      ]
    );
  }

  const setParts = ["status = $2", "approved_by = $3", "updated_at = NOW()"];
  const setValues = [adjustmentId, action === "approve" ? "approved" : "rejected", action === "approve" ? actorId : null];
  let idx = setValues.length + 1;

  if (await hasColumn(client, "stock_adjustments", "reviewed_by")) {
    setParts.push(`reviewed_by = $${idx++}`);
    setValues.push(actorId);
  }
  if (await hasColumn(client, "stock_adjustments", "reviewed_at")) {
    setParts.push("reviewed_at = NOW()");
  }
  if (await hasColumn(client, "stock_adjustments", "review_notes")) {
    setParts.push(`review_notes = $${idx++}`);
    setValues.push(reviewNotes);
  }

  const updated = await client.query(
    `UPDATE public.stock_adjustments
     SET ${setParts.join(", ")}
     WHERE id = $1
     RETURNING *`,
    setValues
  );
  return updated.rows[0];
}

async function processStockCountReview(client, params) {
  const countId = params?.p_count_id;
  const action = String(params?.p_action || "").trim().toLowerCase();
  const reviewNotes = String(params?.p_review_notes || "").trim() || null;
  const actorId = params?.p_actor_id || null;
  if (!["approve", "reject"].includes(action)) throw new Error("invalid action");

  const countRes = await client.query("SELECT * FROM public.stock_counts WHERE id = $1 FOR UPDATE", [countId]);
  if (!countRes.rows.length) throw new Error("stock count not found");
  const count = countRes.rows[0];
  if (String(count.status) !== "completed") throw new Error("stock count is not ready for review");

  if (action === "approve") {
    const itemRows = await client.query(
      "SELECT * FROM public.stock_count_items WHERE count_id = $1 AND organization_id = $2",
      [count.id, count.organization_id]
    );
    for (const item of itemRows.rows) {
      const delta = Number(item.counted_quantity || 0) - Number(item.system_quantity || 0);
      if (!delta) continue;

      await client.query(
        `UPDATE public.inventory_items
         SET current_stock = $2, updated_at = NOW()
         WHERE id = $1 AND organization_id = $3`,
        [item.item_id, item.counted_quantity || 0, count.organization_id]
      );

      await client.query(
        `INSERT INTO public.stock_movements
         (item_id, movement_type, reference_type, reference_id, quantity, from_location, to_location, notes, created_by, organization_id)
         VALUES ($1, 'adjustment', 'adjustment', $2, $3, $4, $5, $6, $7, $8)`,
        [
          item.item_id,
          count.id,
          Math.abs(delta),
          delta < 0 ? count.location || null : null,
          delta > 0 ? count.location || null : null,
          `Stock count adjustment: ${count.count_number} (${count.location || "-"})`,
          actorId,
          count.organization_id,
        ]
      );
    }
  }

  const nextStatus = action === "approve" ? "reconciled" : "in_progress";
  const appendNote = action === "approve" ? "Reconciled" : "Recount requested";
  const updated = await client.query(
    `UPDATE public.stock_counts
     SET status = $2,
         approved_by = $3,
         updated_at = NOW(),
         notes = concat_ws(E'\n', NULLIF(trim(coalesce(notes, '')), ''), $4, $5)
     WHERE id = $1
     RETURNING *`,
    [count.id, nextStatus, action === "approve" ? actorId : null, `${appendNote} by ${actorId || "system"}`, reviewNotes]
  );
  return updated.rows[0];
}

async function processReceiveTransactionReview(client, params) {
  const txnId = params?.p_receive_transaction_id;
  const action = String(params?.p_action || "").trim().toLowerCase();
  const reviewNotes = String(params?.p_review_notes || "").trim() || null;
  const actorId = params?.p_actor_id || null;
  if (!["approve", "reject", "return"].includes(action)) throw new Error("invalid action");

  const txnRes = await client.query("SELECT * FROM public.receive_transactions WHERE id = $1 FOR UPDATE", [txnId]);
  if (!txnRes.rows.length) throw new Error("receive transaction not found");
  const txn = txnRes.rows[0];
  if (String(txn.status) !== "pending_approval") throw new Error("receive transaction already processed");

  if (action === "approve") {
    const itemRows = await client.query(
      "SELECT * FROM public.receive_transaction_items WHERE receive_transaction_id = $1",
      [txn.id]
    );
    let totalQty = 0;
    let totalApprovedQty = 0;
    let hasIssueQty = false;
    for (const item of itemRows.rows) {
      const itemQty = Math.max(0, Number(item.quantity || 0));
      const issueQty = Math.max(0, Number(item.issue_quantity || 0));
      const approvedQty = Math.max(0, itemQty - issueQty);
      totalQty += itemQty;
      totalApprovedQty += approvedQty;
      hasIssueQty = hasIssueQty || issueQty > 0;
      if (approvedQty > 0) {
        await client.query(
          `INSERT INTO public.stock_movements
           (item_id, movement_type, reference_type, reference_id, quantity, unit_cost, to_location, notes, created_by, organization_id)
           VALUES ($1, 'in', 'purchase', $2, $3, $4, $5, $6, $7, $8)`,
          [
            item.item_id,
            txn.id,
            approvedQty,
            item.unit_cost || null,
            item.location || null,
            `Receive approved: ${txn.transaction_number}`,
            actorId,
            txn.organization_id,
          ]
        );
      }
      if (item.po_line_id && approvedQty > 0) {
        await client.query(
          `UPDATE public.purchase_order_items
           SET quantity_received = COALESCE(quantity_received, 0) + $2
           WHERE id = $1`,
          [item.po_line_id, approvedQty]
        );
      }
    }

    const finalStatus =
      totalApprovedQty <= 0 && hasIssueQty
        ? "returned"
        : hasIssueQty || totalApprovedQty + 1e-9 < totalQty
          ? "partially_received"
          : "received";

    const updated = await client.query(
      `UPDATE public.receive_transactions
       SET status = $2, reviewed_by = $3, reviewed_at = NOW(), review_notes = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [txn.id, finalStatus, actorId, reviewNotes]
    );
    return updated.rows[0];
  }

  const status = action === "reject" ? "cancelled" : "returned";
  const updated = await client.query(
    `UPDATE public.receive_transactions
     SET status = $2, reviewed_by = $3, reviewed_at = NOW(), review_notes = $4, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [txn.id, status, actorId, reviewNotes]
  );
  return updated.rows[0];
}

async function processProductionRun(client, params) {
  const runId = params?.p_run_id;
  const action = String(params?.p_action || "").trim().toLowerCase();
  const failureReason = String(params?.p_failure_reason || "").trim() || null;
  const actorId = params?.p_actor_id || null;
  if (!["complete", "fail"].includes(action)) throw new Error("invalid action");

  const runRes = await client.query("SELECT * FROM public.production_runs WHERE id = $1 FOR UPDATE", [runId]);
  if (!runRes.rows.length) throw new Error("production run not found");
  const run = runRes.rows[0];
  if (String(run.status) !== "in_progress") throw new Error("production run already processed");

  if (action === "complete") {
    const components = Array.isArray(run.required_components) ? run.required_components : [];
    for (const comp of components) {
      const reqQty = Math.max(Number(comp?.required_base_qty || 0), 0);
      if (!comp?.item_id || reqQty <= 0) continue;
      await client.query(
        `INSERT INTO public.stock_movements
         (item_id, movement_type, reference_type, reference_id, quantity, from_location, to_location, notes, created_by, organization_id)
         VALUES ($1, 'out', 'production', $2, $3, $4, NULL, $5, $6, $7)`,
        [comp.item_id, run.id, reqQty, run.location, `Production consume ${run.production_number}`, actorId, run.organization_id]
      );
    }

    if (run.add_finished_goods && Number(run.finished_good_base_qty || 0) > 0) {
      await client.query(
        `INSERT INTO public.stock_movements
         (item_id, movement_type, reference_type, reference_id, quantity, from_location, to_location, notes, created_by, organization_id)
         VALUES ($1, 'in', 'production', $2, $3, NULL, $4, $5, $6, $7)`,
        [
          run.finished_good_item_id,
          run.id,
          run.finished_good_base_qty,
          run.location,
          `Production output ${run.production_number}`,
          actorId,
          run.organization_id,
        ]
      );
    }

    const updated = await client.query(
      `UPDATE public.production_runs
       SET status = 'completed', completed_at = NOW(), completed_by = $2, failure_reason = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [run.id, actorId]
    );
    return updated.rows[0];
  }

  const updated = await client.query(
    `UPDATE public.production_runs
     SET status = 'failed', failed_at = NOW(), completed_by = $2, failure_reason = $3, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [run.id, actorId, failureReason]
  );
  return updated.rows[0];
}

export async function runRpc(fnName, params = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let data;
    if (fnName === "convert_item_quantity") {
      data = await convertItemQuantity(client, params);
    } else if (fnName === "process_stock_adjustment_review") {
      data = await processStockAdjustmentReview(client, params);
    } else if (fnName === "process_stock_count_review") {
      data = await processStockCountReview(client, params);
    } else if (fnName === "process_receive_transaction_review") {
      data = await processReceiveTransactionReview(client, params);
    } else if (fnName === "process_production_run") {
      data = await processProductionRun(client, params);
    } else {
      throw new Error(`RPC not implemented on external DB: ${fnName}`);
    }
    await client.query("COMMIT");
    return { data };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

