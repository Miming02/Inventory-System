# Frontend (React + Vite)

Documentation index (requirements, architecture, checklist 0.1–0.7, setup, quality): **[../docs/README.md](../docs/README.md)**.

## Run

```bash
npm install
npm run dev
```

## Notes

- UI is converted from your admin dashboard HTML into React (`src/App.jsx`).
- Tailwind classes are powered through the CDN setup in `index.html` for quick startup.
- Next step is to move to full Tailwind package config when you start building reusable components.
# Frontend Structure

This is a feature-first React + TypeScript frontend structure designed for scalability.

## Suggested Folder Tree

```text
frontend/
  public/
  src/
    app/
      providers/
        query-client.ts
      router/
        index.tsx
      App.tsx
      main.tsx
    features/
      auth/
        api/
        components/
        hooks/
        pages/
        types.ts
      products/
        api/
        components/
        hooks/
        pages/
        types.ts
      inventory/
        api/
        components/
        hooks/
        pages/
        types.ts
      warehouses/
        api/
        components/
        hooks/
        pages/
        types.ts
      reports/
        api/
        components/
        hooks/
        pages/
        types.ts
    shared/
      api/
        client.ts
        endpoints.ts
      config/
        env.ts
      constants/
      hooks/
      lib/
      types/
        api.ts
        domain.ts
      ui/
        Button.tsx
        Input.tsx
        Table.tsx
      utils/
    styles/
      globals.css
  .env.example
  index.html
  package.json
  tsconfig.json
  vite.config.ts
```

## Layer Responsibilities

- `app/`: app bootstrap, routing, global providers
- `features/`: business domains and feature-specific UI/data logic
- `shared/api/`: HTTP client, interceptors, and reusable request helpers
- `shared/ui/`: reusable presentational components
- `shared/types/`: shared API and domain type definitions

## Development Guidance

- Keep API calls near feature modules (`features/*/api`) and use shared client.
- Keep domain types colocated with features, and export common types through `shared/types`.
- Use React Query for server state and avoid global state unless truly needed.
