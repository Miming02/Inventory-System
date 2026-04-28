import { pool } from "./db.js";

const ALLOWED_TABLES = new Set([
  "users",
  "organizations",
  "roles",
  "profiles",
  "categories",
  "locations",
  "suppliers",
  "inventory_items",
  "purchase_orders",
  "purchase_order_items",
  "stock_movements",
  "stock_transfers",
  "stock_transfer_items",
  "stock_counts",
  "stock_count_items",
  "stock_adjustments",
  "notifications",
  "audit_logs",
  "unit_conversions",
  "item_unit_conversions",
  "boms",
  "bom_items",
  "inventory_item_locations",
  "receive_transactions",
  "receive_transaction_items",
  "delivery_requests",
  "delivery_request_items",
  "production_runs",
]);

function quoteIdent(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function ensureAllowedTable(table) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table not allowed: ${table}`);
  }
}

const RELATION_MAP = {
  inventory_items: {
    categories: { type: "one", localKey: "category_id", remoteTable: "categories", remoteKey: "id" },
  },
  purchase_orders: {
    suppliers: { type: "one", localKey: "supplier_id", remoteTable: "suppliers", remoteKey: "id" },
    profiles: { type: "one", localKey: "created_by", remoteTable: "profiles", remoteKey: "id" },
    purchase_order_items: { type: "many", localKey: "id", remoteTable: "purchase_order_items", remoteForeignKey: "po_id" },
  },
  purchase_order_items: {
    inventory_items: { type: "one", localKey: "item_id", remoteTable: "inventory_items", remoteKey: "id" },
  },
  stock_transfers: {
    profiles: { type: "one", localKey: "created_by", remoteTable: "profiles", remoteKey: "id" },
    stock_transfer_items: { type: "many", localKey: "id", remoteTable: "stock_transfer_items", remoteForeignKey: "transfer_id" },
  },
  stock_adjustments: {
    profiles: { type: "one", localKey: "created_by", remoteTable: "profiles", remoteKey: "id" },
    inventory_items: { type: "one", localKey: "item_id", remoteTable: "inventory_items", remoteKey: "id" },
  },
  stock_movements: {
    inventory_items: { type: "one", localKey: "item_id", remoteTable: "inventory_items", remoteKey: "id" },
  },
  profiles: {
    roles: { type: "one", localKey: "role_id", remoteTable: "roles", remoteKey: "id" },
  },
  item_unit_conversions: {
    inventory_items: { type: "one", localKey: "item_id", remoteTable: "inventory_items", remoteKey: "id" },
  },
  bom_items: {
    inventory_items: { type: "one", localKey: "component_item_id", remoteTable: "inventory_items", remoteKey: "id" },
  },
  stock_count_items: {
    inventory_items: { type: "one", localKey: "item_id", remoteTable: "inventory_items", remoteKey: "id" },
  },
  receive_transactions: {
    receive_transaction_items: {
      type: "many",
      localKey: "id",
      remoteTable: "receive_transaction_items",
      remoteForeignKey: "receive_transaction_id",
    },
  },
  receive_transaction_items: {
    receive_transactions: {
      type: "one",
      localKey: "receive_transaction_id",
      remoteTable: "receive_transactions",
      remoteKey: "id",
    },
  },
  delivery_requests: {
    delivery_request_items: {
      type: "many",
      localKey: "id",
      remoteTable: "delivery_request_items",
      remoteForeignKey: "delivery_request_id",
    },
  },
  production_runs: {
    inventory_items: { type: "one", localKey: "finished_good_item_id", remoteTable: "inventory_items", remoteKey: "id" },
  },
};

function splitTopLevel(input) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = input.slice(start).trim();
  if (tail) out.push(tail);
  return out.filter(Boolean);
}

function parseHeadToken(head) {
  let alias = null;
  let relationSpec = head.trim();
  if (relationSpec.includes(":")) {
    const idx = relationSpec.indexOf(":");
    alias = relationSpec.slice(0, idx).trim();
    relationSpec = relationSpec.slice(idx + 1).trim();
  }
  const relationName = relationSpec.split("!")[0].trim();
  return { alias: alias || relationName, relationName };
}

function parseColumnNode(token) {
  const open = token.indexOf("(");
  const close = token.lastIndexOf(")");
  if (open === -1 || close === -1 || close < open) {
    return { type: "column", name: token.trim() };
  }
  const head = token.slice(0, open).trim();
  const body = token.slice(open + 1, close).trim();
  if (!head) throw new Error(`Invalid relation select token: ${token}`);
  const { alias, relationName } = parseHeadToken(head);
  const children = splitTopLevel(body).map(parseColumnNode);
  return { type: "relation", alias, relationName, children };
}

function parseColumns(columns) {
  const raw = String(columns || "*").trim();
  if (raw === "*" || raw.length === 0) {
    return { nodes: [{ type: "column", name: "*" }] };
  }
  return { nodes: splitTopLevel(raw).map(parseColumnNode) };
}

function getBaseColumnsFromNodes(nodes) {
  const cols = nodes.filter((n) => n.type === "column").map((n) => n.name);
  return cols.length ? cols : ["*"];
}

function getRelationNodes(nodes) {
  return nodes.filter((n) => n.type === "relation");
}

function selectSqlForBase(baseCols) {
  if (baseCols.length === 1 && baseCols[0] === "*") return "*";
  return baseCols.map((c) => quoteIdent(c)).join(", ");
}

function applyRelationFiltersToRows(rows, relationFilters = []) {
  if (!relationFilters.length) return rows;
  return rows.filter((row) => {
    for (const rf of relationFilters) {
      const relValue = row[rf.relation];
      const value = rf.value;
      const op = rf.op;
      const key = rf.column;

      if (Array.isArray(relValue)) {
        const matched = relValue.some((item) => {
          const v = item?.[key];
          if (op === "eq") return v === value;
          if (op === "neq") return v !== value;
          if (op === "lte") return v <= value;
          if (op === "in") return (Array.isArray(value) ? value : []).includes(v);
          if (op === "is_null") return v == null;
          if (op === "not_is_null") return v != null;
          return false;
        });
        if (!matched) return false;
      } else if (relValue && typeof relValue === "object") {
        const v = relValue[key];
        if (op === "eq" && v !== value) return false;
        if (op === "neq" && v === value) return false;
        if (op === "lte" && !(v <= value)) return false;
        if (op === "in" && !(Array.isArray(value) ? value : []).includes(v)) return false;
        if (op === "is_null" && v != null) return false;
        if (op === "not_is_null" && v == null) return false;
      } else {
        return false;
      }
    }
    return true;
  });
}

async function attachRelations(rows, table, relationNodes) {
  if (!rows.length || !relationNodes.length) return rows;
  const result = rows.map((r) => ({ ...r }));
  const relDefs = RELATION_MAP[table] || {};

  for (const rel of relationNodes) {
    const def = relDefs[rel.relationName];
    if (!def) {
      throw new Error(`Relation not supported on ${table}: ${rel.relationName}`);
    }
    ensureAllowedTable(def.remoteTable);
    const childBaseCols = getBaseColumnsFromNodes(rel.children);
    const childRelationNodes = getRelationNodes(rel.children);
    const requestedCols = childBaseCols.filter((c) => c !== "*");

    if (def.type === "one") {
      const ids = [...new Set(result.map((r) => r[def.localKey]).filter(Boolean))];
      if (!ids.length) {
        for (const row of result) row[rel.alias] = null;
        continue;
      }
      const cols = requestedCols.length
        ? [def.remoteKey, ...requestedCols.filter((c) => c !== def.remoteKey)]
        : [def.remoteKey, "*"];
      const querySql = cols.includes("*")
        ? `SELECT * FROM public.${quoteIdent(def.remoteTable)} WHERE ${quoteIdent(def.remoteKey)} = ANY($1)`
        : `SELECT ${cols.map(quoteIdent).join(", ")} FROM public.${quoteIdent(def.remoteTable)} WHERE ${quoteIdent(
            def.remoteKey
          )} = ANY($1)`;
      const { rows: relRowsRaw } = await pool.query(querySql, [ids]);
      const relRows = await attachRelations(relRowsRaw, def.remoteTable, childRelationNodes);
      const relMap = new Map(relRows.map((r) => [r[def.remoteKey], r]));
      for (const row of result) {
        const match = relMap.get(row[def.localKey]) || null;
        if (!match) row[rel.alias] = null;
        else {
          if (!requestedCols.length && !childRelationNodes.length) row[rel.alias] = match;
          else {
            const obj = {};
            for (const k of requestedCols) obj[k] = match[k] ?? null;
            for (const childRel of childRelationNodes) obj[childRel.alias] = match[childRel.alias];
            row[rel.alias] = obj;
          }
        }
      }
      continue;
    }

    if (def.type === "many") {
      const ids = [...new Set(result.map((r) => r[def.localKey]).filter(Boolean))];
      const cols = requestedCols.length
        ? [def.remoteForeignKey, ...requestedCols.filter((c) => c !== def.remoteForeignKey)]
        : [def.remoteForeignKey, "*"];
      let relRows = [];
      if (ids.length) {
        const querySql = cols.includes("*")
          ? `SELECT * FROM public.${quoteIdent(def.remoteTable)} WHERE ${quoteIdent(def.remoteForeignKey)} = ANY($1)`
          : `SELECT ${cols.map(quoteIdent).join(", ")} FROM public.${quoteIdent(def.remoteTable)} WHERE ${quoteIdent(
              def.remoteForeignKey
            )} = ANY($1)`;
        const query = await pool.query(querySql, [ids]);
        relRows = await attachRelations(query.rows, def.remoteTable, childRelationNodes);
      }
      const group = new Map();
      for (const r of relRows) {
        const key = r[def.remoteForeignKey];
        if (!group.has(key)) group.set(key, []);
        if (!requestedCols.length && !childRelationNodes.length) group.get(key).push(r);
        else {
          const item = {};
          for (const k of requestedCols) item[k] = r[k] ?? null;
          for (const childRel of childRelationNodes) item[childRel.alias] = r[childRel.alias];
          group.get(key).push(item);
        }
      }
      for (const row of result) {
        row[rel.alias] = group.get(row[def.localKey]) || [];
      }
    }
  }

  return result;
}

function applyFilters(filters, params, startIndex = 1) {
  const clauses = [];
  let idx = startIndex;
  for (const f of filters || []) {
    const col = quoteIdent(f.column);
    if (f.op === "eq") {
      clauses.push(`${col} = $${idx++}`);
      params.push(f.value);
    } else if (f.op === "neq") {
      clauses.push(`${col} <> $${idx++}`);
      params.push(f.value);
    } else if (f.op === "lte") {
      clauses.push(`${col} <= $${idx++}`);
      params.push(f.value);
    } else if (f.op === "in") {
      clauses.push(`${col} = ANY($${idx++})`);
      params.push(Array.isArray(f.value) ? f.value : []);
    } else if (f.op === "is_null") {
      clauses.push(`${col} IS NULL`);
    } else if (f.op === "not_is_null") {
      clauses.push(`${col} IS NOT NULL`);
    } else {
      throw new Error(`Unsupported filter op: ${f.op}`);
    }
  }
  return { clauses, nextIdx: idx };
}

export async function runDbQuery(payload) {
  const { table, columns = "*", filters = [], orderBy = [], limit, offset, count = false } = payload || {};
  ensureAllowedTable(table);
  const parsed = parseColumns(columns);
  const params = [];
  const baseFilters = [];
  const relationFilters = [];
  for (const f of filters || []) {
    const col = String(f.column || "");
    if (col.includes(".")) {
      const [relation, relationColumn] = col.split(".", 2);
      relationFilters.push({ relation: relation.trim(), column: relationColumn.trim(), op: f.op, value: f.value });
    } else {
      baseFilters.push(f);
    }
  }
  const baseColumns = getBaseColumnsFromNodes(parsed.nodes);
  const where = applyFilters(baseFilters, params);
  const whereSql = where.clauses.length ? ` WHERE ${where.clauses.join(" AND ")}` : "";
  const orderSql = (orderBy || [])
    .map((o) => `${quoteIdent(o.column)} ${o.ascending === false ? "DESC" : "ASC"}`)
    .join(", ");
  const limitSql = Number.isFinite(limit) ? ` LIMIT ${Math.max(0, Number(limit))}` : "";
  const offsetSql = Number.isFinite(offset) && offset > 0 ? ` OFFSET ${Math.max(0, Number(offset))}` : "";

  const sql = `SELECT ${selectSqlForBase(baseColumns)} FROM public.${quoteIdent(table)}${whereSql}${orderSql ? ` ORDER BY ${orderSql}` : ""}${limitSql}${offsetSql}`;
  const dataResult = await pool.query(sql, params);
  const relationNodes = getRelationNodes(parsed.nodes);
  const withRelations = await attachRelations(dataResult.rows, table, relationNodes);
  const data = applyRelationFiltersToRows(withRelations, relationFilters);

  let totalCount = null;
  if (count) {
    if (relationFilters.length) {
      totalCount = data.length;
    } else {
      const countSql = `SELECT COUNT(*)::int AS c FROM public.${quoteIdent(table)}${whereSql}`;
      const countResult = await pool.query(countSql, params);
      totalCount = countResult.rows?.[0]?.c ?? 0;
    }
  }

  return { data, count: totalCount };
}

export async function runDbMutate(payload, userId) {
  const { table, action, values, filters = [], onConflict } = payload || {};
  ensureAllowedTable(table);
  const params = [];

  let orgId = null;
  if (userId) {
    const orgRes = await pool.query("SELECT organization_id FROM public.users WHERE id = $1", [userId]);
    orgId = orgRes.rows[0]?.organization_id || "a0000000-0000-4000-8000-000000000001";
  } else {
    orgId = "a0000000-0000-4000-8000-000000000001";
  }

  const { rows: colRows } = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
    [table]
  );
  const hasOrgId = colRows.some((c) => c.column_name === "organization_id");

  const injectOrg = (obj) => {
    if (!obj) return obj;
    const next = { ...obj };
    if (hasOrgId && orgId && !("organization_id" in next)) {
      next.organization_id = orgId;
    }
    return next;
  };

  if (action === "insert") {
    let rows = Array.isArray(values) ? values : [values];
    rows = rows.map(injectOrg);
    if (!rows.length) return { data: [] };
    const keys = Object.keys(rows[0] || {});
    if (!keys.length) return { data: [] };
    const colsSql = keys.map(quoteIdent).join(", ");
    const valuesSql = rows
      .map((row) => {
        const ph = keys.map((k) => {
          params.push(row[k]);
          return `$${params.length}`;
        });
        return `(${ph.join(", ")})`;
      })
      .join(", ");
    const sql = `INSERT INTO public.${quoteIdent(table)} (${colsSql}) VALUES ${valuesSql} RETURNING *`;
    const result = await pool.query(sql, params);
    return { data: result.rows };
  }

  if (action === "upsert") {
    let rows = Array.isArray(values) ? values : [values];
    rows = rows.map(injectOrg);
    if (!rows.length) return { data: [] };
    const keys = Object.keys(rows[0] || {});
    if (!keys.length) return { data: [] };
    const conflictCols = String(onConflict || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!conflictCols.length) throw new Error("upsert requires onConflict");
    const colsSql = keys.map(quoteIdent).join(", ");
    const valuesSql = rows
      .map((row) => {
        const ph = keys.map((k) => {
          params.push(row[k]);
          return `$${params.length}`;
        });
        return `(${ph.join(", ")})`;
      })
      .join(", ");
    const updateCols = keys.filter((k) => !conflictCols.includes(k));
    const updateSql = updateCols.map((k) => `${quoteIdent(k)} = EXCLUDED.${quoteIdent(k)}`).join(", ");
    const sql = `INSERT INTO public.${quoteIdent(table)} (${colsSql}) VALUES ${valuesSql} ON CONFLICT (${conflictCols
      .map(quoteIdent)
      .join(", ")}) DO UPDATE SET ${updateSql} RETURNING *`;
    const result = await pool.query(sql, params);
    return { data: result.rows };
  }

  if (action === "update") {
    const data = injectOrg(values || {});
    const keys = Object.keys(data);
    if (!keys.length) return { data: [] };
    const setSql = keys
      .map((k) => {
        params.push(data[k]);
        return `${quoteIdent(k)} = $${params.length}`;
      })
      .join(", ");
    const where = applyFilters(filters, params, params.length + 1);
    if (!where.clauses.length) throw new Error("update requires filters");
    const sql = `UPDATE public.${quoteIdent(table)} SET ${setSql} WHERE ${where.clauses.join(" AND ")} RETURNING *`;
    const result = await pool.query(sql, params);
    return { data: result.rows };
  }

  if (action === "delete") {
    const where = applyFilters(filters, params);
    if (!where.clauses.length) throw new Error("delete requires filters");
    const sql = `DELETE FROM public.${quoteIdent(table)} WHERE ${where.clauses.join(" AND ")} RETURNING *`;
    const result = await pool.query(sql, params);
    return { data: result.rows };
  }

  throw new Error(`Unsupported mutate action: ${action}`);
}

