-- Hide demo/showroom seeded items from active inventory lists.
-- Keeps historical references intact (POs, movements, logs) by soft-deactivating.

UPDATE public.inventory_items
SET is_active = false,
    updated_at = NOW()
WHERE sku IN ('SKU-GLS-400', 'SKU-OAK-22', 'SKU-RUG-09')
   OR name IN ('Glass Pendant Light', 'Nordic Lounge Chair', 'Textured Wool Rug');
