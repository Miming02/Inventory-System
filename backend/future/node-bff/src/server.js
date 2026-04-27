import "dotenv/config";
import express from "express";
import cors from "cors";
import { dbPing, ensureCoreTables, pool } from "./db.js";
import { runDbMutate, runDbQuery } from "./queryApi.js";
import { runRpc } from "./rpcApi.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "inventory-node-bff",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/db", async (_req, res) => {
  try {
    const ok = await dbPing();
    res.json({ ok });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/db/query", async (req, res) => {
  try {
    const result = await runDbQuery(req.body || {});
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/db/mutate", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || null;
    const result = await runDbMutate(req.body || {}, userId);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/db/rpc", async (req, res) => {
  try {
    const { fnName, params } = req.body || {};
    const result = await runRpc(fnName, params || {});
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/auth/sync-user", async (req, res) => {
  try {
    const user = req.body?.user || {};
    const profile = req.body?.profile || null;
    const id = user?.id;
    if (!id) {
      throw new Error("user.id is required");
    }

    const email = user?.email || null;
    const firstName = profile?.first_name ?? null;
    const lastName = profile?.last_name ?? null;
    const avatarUrl = profile?.avatar_url ?? null;
    const roleName = profile?.role_name ?? null;
    const organizationId = profile?.organization_id ?? null;
    const organizationName = profile?.organization_name ?? null;

    const sql = `
      INSERT INTO public.users (
        id, email, first_name, last_name, avatar_url, role_name, organization_id, organization_name, last_login_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        email = COALESCE(NULLIF(EXCLUDED.email, ''), public.users.email),
        first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
        last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        role_name = COALESCE(NULLIF(EXCLUDED.role_name, ''), public.users.role_name),
        organization_id = COALESCE(EXCLUDED.organization_id, public.users.organization_id),
        organization_name = COALESCE(NULLIF(EXCLUDED.organization_name, ''), public.users.organization_name),
        last_login_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;
    const { rows } = await pool.query(sql, [
      id,
      email,
      firstName,
      lastName,
      avatarUrl,
      roleName,
      organizationId,
      organizationName,
    ]);

    res.json({ ok: true, data: rows[0] || null });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 8787;

ensureCoreTables()
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`[node-bff] listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[node-bff] failed to initialize database:", error);
    process.exit(1);
  });

