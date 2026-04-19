-- ========================================
-- Optional starter data (idempotent)
-- ========================================
-- Tumatakbo lang kung **walang** row sa `public.suppliers` (tulad ng bagong project).
-- Naglalagay ng: categories, suppliers, inventory_items, purchase_orders,
-- purchase_order_items, stock_movements.
--
-- Tandaan: may trigger sa `stock_movements` na nagdaragdag sa `current_stock`
-- kapag `in` / `out` — kaya nagsisimula ang items sa 0 bago ang movements.
--
-- Pagkatapos i-run: i-refresh ang Table Editor; buksan ang app bilang Admin/Warehouse/Procurement.

DO $$
DECLARE
  v_cat_elec   uuid := 'a1000000-0000-4000-8000-000000000001';
  v_cat_office uuid := 'a1000000-0000-4000-8000-000000000002';
  v_cat_raw    uuid := 'a1000000-0000-4000-8000-000000000003';
  v_sup_a      uuid := 'a2000000-0000-4000-8000-000000000001';
  v_sup_b      uuid := 'a2000000-0000-4000-8000-000000000002';
  v_sup_c      uuid := 'a2000000-0000-4000-8000-000000000003';
  v_item1      uuid := 'a3000000-0000-4000-8000-000000000001';
  v_item2      uuid := 'a3000000-0000-4000-8000-000000000002';
  v_item3      uuid := 'a3000000-0000-4000-8000-000000000003';
  v_po1        uuid := 'a4000000-0000-4000-8000-000000000001';
  v_po2        uuid := 'a4000000-0000-4000-8000-000000000002';
BEGIN
  IF EXISTS (SELECT 1 FROM public.suppliers LIMIT 1) THEN
    RAISE NOTICE '006_seed_reference_data: skipped (suppliers table already has rows).';
    RETURN;
  END IF;

  INSERT INTO public.categories (id, name, description)
  VALUES
    (v_cat_elec, 'Electronics', 'Devices, cables, components'),
    (v_cat_office, 'Office', 'Paper, pens, organizers'),
    (v_cat_raw, 'Raw materials', 'Inputs for production')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.suppliers (id, name, contact_person, email, phone, address, payment_terms)
  VALUES
    (v_sup_a, 'Northwoods Manufacturing', 'J. Cruz', 'orders@northwoods.example', '+63-2-555-0101', 'Laguna, PH', 'Net 30'),
    (v_sup_b, 'Aurora Glass Co.', 'M. Reyes', 'sales@aurora.example', '+63-2-555-0102', 'Cavite, PH', 'Net 15'),
    (v_sup_c, 'Textile Partners Inc.', 'A. Lim', 'procurement@textile.example', '+63-2-555-0103', 'Bulacan, PH', 'Net 30')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.inventory_items (
    id, sku, name, description, category_id, unit_of_measure, unit_cost, selling_price,
    reorder_level, max_stock, current_stock, location, is_active
  ) VALUES
    (v_item1, 'SKU-OAK-22', 'Nordic Lounge Chair', 'Oak frame lounge chair', v_cat_elec, 'unit', 12000.00, 18990.00, 5, 200, 0, 'Main Warehouse — Aisle 4B', true),
    (v_item2, 'SKU-GLS-400', 'Glass Pendant Light', 'Pendant lighting fixture', v_cat_elec, 'unit', 3500.00, 5990.00, 10, 150, 0, 'Main Warehouse — QC Bay', true),
    (v_item3, 'SKU-RUG-09', 'Textured Wool Rug', 'Area rug 160x230cm', v_cat_office, 'unit', 4500.00, 7990.00, 8, 120, 0, 'Main Warehouse — Dock 4', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.purchase_orders (
    id, po_number, supplier_id, status, priority, expected_delivery_date,
    subtotal, tax_amount, total_amount, notes
  ) VALUES (
    v_po1,
    'PO-SEED-001',
    v_sup_a,
    'confirmed',
    'high',
    CURRENT_DATE + 7,
    540000.00,
    0,
    540000.00,
    'Seed PO — received lines (see stock_movements)'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.purchase_order_items (po_id, item_id, quantity_ordered, quantity_received, unit_price)
  VALUES
    (v_po1, v_item1, 45, 45, 12000.00),
    (v_po1, v_item2, 12, 12, 3500.00),
    (v_po1, v_item3, 200, 200, 4500.00);

  INSERT INTO public.stock_movements (
    item_id, movement_type, reference_type, reference_id, quantity, unit_cost, to_location, notes
  ) VALUES
    (v_item1, 'in', 'purchase', v_po1, 45, 12000.00, 'Main Warehouse — Aisle 4B', 'Received vs PO-SEED-001'),
    (v_item2, 'in', 'purchase', v_po1, 12, 3500.00, 'Main Warehouse — QC Bay', 'Received vs PO-SEED-001'),
    (v_item3, 'in', 'purchase', v_po1, 200, 4500.00, 'Main Warehouse — Dock 4', 'Received vs PO-SEED-001');

  INSERT INTO public.purchase_orders (
    id, po_number, supplier_id, status, priority, expected_delivery_date,
    subtotal, tax_amount, total_amount, notes
  ) VALUES (
    v_po2,
    'PO-SEED-002',
    v_sup_b,
    'draft',
    'medium',
    CURRENT_DATE + 14,
    35000.00,
    0,
    35000.00,
    'Seed draft PO (pending KPI)'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.purchase_order_items (po_id, item_id, quantity_ordered, quantity_received, unit_price)
  VALUES (v_po2, v_item2, 10, 0, 3500.00);

  RAISE NOTICE '006_seed_reference_data: OK — suppliers, categories, 3 items, 2 POs, inbound movements.';
END $$;
