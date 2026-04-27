import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8787";
const useExternalDb = String(import.meta.env.VITE_USE_EXTERNAL_DB || "true") === "true";
const allowSupabaseFallback = String(import.meta.env.VITE_EXTERNAL_DB_FALLBACK || "false") === "true";
const EXTERNAL_API_TIMEOUT_MS = Number(import.meta.env.VITE_EXTERNAL_DB_TIMEOUT_MS || 2500);

const rawSupabase = createClient(supabaseUrl, supabaseAnonKey);
const warnedFallbackKeys = new Set();
let externalApiDownUntil = 0;
let cachedAuthUserId = null;
let cachedAuthUserIdAt = 0;

async function getAuthUserId() {
  const now = Date.now();
  if (now - cachedAuthUserIdAt < 2000) return cachedAuthUserId;
  cachedAuthUserIdAt = now;
  try {
    const { data } = await rawSupabase.auth.getSession();
    cachedAuthUserId = data?.session?.user?.id || null;
    return cachedAuthUserId;
  } catch {
    cachedAuthUserId = null;
    return null;
  }
}

async function callNode(path, body) {
  if (Date.now() < externalApiDownUntil) {
    return { data: null, error: { message: "External DB API temporarily unavailable" }, count: null };
  }
  try {
    const userId = await getAuthUserId();
    const headers = { "content-type": "application/json" };
    if (userId) {
      headers["x-user-id"] = userId;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EXTERNAL_API_TIMEOUT_MS);
    const res = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    let payload = null;
    try {
      payload = await res.json();
    } catch (_e) {
      payload = { ok: false, error: `Invalid JSON response from ${path}` };
    }
    if (!res.ok || payload?.ok === false) {
      if (res.status >= 500) {
        externalApiDownUntil = Date.now() + 10000;
      }
      return { data: null, error: { message: payload?.error || `Request failed: ${res.status}` }, count: null };
    }
    externalApiDownUntil = 0;
    return { data: payload.data ?? null, error: null, count: payload.count ?? null };
  } catch (error) {
    externalApiDownUntil = Date.now() + 10000;
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : String(error) },
      count: null,
    };
  }
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.action = "select";
    this.columns = "*";
    this.options = {};
    this.values = null;
    this.filters = [];
    this.orders = [];
    this.limitValue = null;
    this.singleMode = null;
    this.returningColumns = "*";
  }

  select(columns = "*", options = {}) {
    if (["insert", "upsert", "update", "delete"].includes(this.action)) {
      // Supabase supports chaining .select() after mutation to choose returned columns.
      this.returningColumns = columns || "*";
      this.options = options || {};
    } else {
      this.action = "select";
      this.columns = columns;
      this.options = options || {};
    }
    return this;
  }

  insert(values, options = {}) {
    this.action = "insert";
    this.values = values;
    this.options = options || {};
    return this;
  }

  upsert(values, options = {}) {
    this.action = "upsert";
    this.values = values;
    this.options = options || {};
    return this;
  }

  update(values, options = {}) {
    this.action = "update";
    this.values = values;
    this.options = options || {};
    return this;
  }

  delete(options = {}) {
    this.action = "delete";
    this.options = options || {};
    return this;
  }

  eq(column, value) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ op: "neq", column, value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ op: "lte", column, value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ op: "gte", column, value });
    return this;
  }

  in(column, value) {
    this.filters.push({ op: "in", column, value });
    return this;
  }

  or(value) {
    this.filters.push({ op: "or", value });
    return this;
  }

  not(column, operator, value) {
    if (operator === "is" && value === null) {
      this.filters.push({ op: "not_is_null", column });
    }
    return this;
  }

  order(column, opts = {}) {
    this.orders.push({ column, ascending: opts?.ascending !== false });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  range(from, to) {
    // PostgREST limits via range.
    // count is to - from + 1
    // offset is from
    this.limitValue = to - from + 1;
    this.options = { ...this.options, offset: from };
    return this;
  }

  shouldFallbackToSupabase() {
    if (!useExternalDb) return true;
    return allowSupabaseFallback;
  }

  async executeWithSupabaseFallback() {
    const fallbackKey = `${this.table}:${this.action}:${String(this.columns || "*")}`;
    if (!warnedFallbackKeys.has(fallbackKey)) {
      warnedFallbackKeys.add(fallbackKey);
      // Helps identify remaining queries that still need external DB support.
      // eslint-disable-next-line no-console
      console.warn("[external-db] fallback to Supabase", {
        table: this.table,
        action: this.action,
        columns: this.columns,
        filters: this.filters,
      });
    }
    let q = rawSupabase.from(this.table);
    if (this.action === "select") q = q.select(this.columns, this.options);
    else if (this.action === "insert") q = q.insert(this.values, this.options).select(this.returningColumns);
    else if (this.action === "update") q = q.update(this.values, this.options).select(this.returningColumns);
    else if (this.action === "delete") q = q.delete(this.options).select(this.returningColumns);
    else if (this.action === "upsert") q = q.upsert(this.values, this.options).select(this.returningColumns);

    for (const f of this.filters) {
      if (f.op === "eq") q = q.eq(f.column, f.value);
      else if (f.op === "neq") q = q.neq(f.column, f.value);
      else if (f.op === "lte") q = q.lte(f.column, f.value);
      else if (f.op === "gte") q = q.gte(f.column, f.value);
      else if (f.op === "in") q = q.in(f.column, f.value);
      else if (f.op === "or") q = q.or(f.value);
      else if (f.op === "not_is_null") q = q.not(f.column, "is", null);
    }
    for (const o of this.orders) q = q.order(o.column, { ascending: o.ascending });
    if (Number.isFinite(this.options?.offset)) {
      q = q.range(this.options.offset, this.options.offset + (this.limitValue || 1) - 1);
    } else if (Number.isFinite(this.limitValue)) {
      q = q.limit(this.limitValue);
    }
    if (this.singleMode === "single") q = q.single();
    else if (this.singleMode === "maybeSingle") q = q.maybeSingle();
    return q;
  }

  normalizeSingleResult(result) {
    if (this.singleMode === "single") {
      if (!result.error && Array.isArray(result.data)) {
        if (result.data.length !== 1) {
          return { ...result, data: null, error: { message: "Expected exactly one row" } };
        }
        return { ...result, data: result.data[0] };
      }
    }
    if (this.singleMode === "maybeSingle") {
      if (!result.error && Array.isArray(result.data)) {
        return { ...result, data: result.data.length ? result.data[0] : null };
      }
    }
    return result;
  }

  async execute() {
    if (this.shouldFallbackToSupabase()) {
      return this.executeWithSupabaseFallback();
    }

    if (this.action === "select") {
      const result = await callNode("/api/db/query", {
        table: this.table,
        columns: this.columns,
        filters: this.filters,
        orderBy: this.orders,
        limit: this.limitValue,
        offset: this.options?.offset || 0,
        count: this.options?.count === "exact",
      });
      if (result.error) {
        if (this.shouldFallbackToSupabase()) return this.executeWithSupabaseFallback();
        return result;
      }
      return this.normalizeSingleResult(result);
    }

    const result = await callNode("/api/db/mutate", {
      table: this.table,
      action: this.action,
      values: this.values,
      filters: this.filters,
      onConflict: this.options?.onConflict || null,
    });
    if (result.error) {
      if (this.shouldFallbackToSupabase()) return this.executeWithSupabaseFallback();
      return result;
    }
    if (Array.isArray(result.data) && this.returningColumns && this.returningColumns !== "*") {
      const cols = String(this.returningColumns)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((x) => !x.includes("(") && !x.includes(")") && !x.includes("!"));
      if (cols.length) {
        result.data = result.data.map((row) => {
          const next = {};
          for (const c of cols) next[c] = row?.[c] ?? null;
          return next;
        });
      }
    }
    return this.normalizeSingleResult(result);
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

export const supabase = {
  auth: rawSupabase.auth,
  storage: rawSupabase.storage,
  channel: (...args) => rawSupabase.channel(...args),
  removeChannel: (...args) => rawSupabase.removeChannel(...args),
  from: (table) => new QueryBuilder(table),
  rpc: async (fnName, params = {}) => {
    if (useExternalDb) {
      let rpcParams = params || {};
      if (rpcParams.p_actor_id == null) {
        const userId = await getAuthUserId();
        if (userId) {
          rpcParams = { ...rpcParams, p_actor_id: userId };
        }
      }
      const direct = await callNode("/api/db/rpc", { fnName, params: rpcParams });
      if (!direct.error) return direct;
      if (!allowSupabaseFallback) return direct;
    }
    return rawSupabase.rpc(fnName, params);
  },
};
