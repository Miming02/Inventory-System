-- Per-location inventory balances and stock movement synchronization.

CREATE TABLE IF NOT EXISTS inventory_item_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    location VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (item_id, location)
);

CREATE INDEX IF NOT EXISTS idx_inventory_item_locations_item ON inventory_item_locations(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_locations_location ON inventory_item_locations(location);

-- Backfill current item stock into location balances where a location exists.
INSERT INTO inventory_item_locations (item_id, location, quantity)
SELECT id, TRIM(location), GREATEST(current_stock, 0)
FROM inventory_items
WHERE location IS NOT NULL
  AND TRIM(location) <> ''
  AND current_stock > 0
ON CONFLICT (item_id, location)
DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();

-- Keep both global stock and per-location stock in sync.
CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    src_location TEXT;
    dst_location TEXT;
BEGIN
    src_location := NULLIF(TRIM(COALESCE(NEW.from_location, '')), '');
    dst_location := NULLIF(TRIM(COALESCE(NEW.to_location, '')), '');

    IF NEW.movement_type = 'in' THEN
        UPDATE inventory_items
        SET current_stock = current_stock + NEW.quantity
        WHERE id = NEW.item_id;

        IF dst_location IS NOT NULL THEN
            INSERT INTO inventory_item_locations (item_id, location, quantity, updated_at)
            VALUES (NEW.item_id, dst_location, NEW.quantity, NOW())
            ON CONFLICT (item_id, location)
            DO UPDATE SET
                quantity = inventory_item_locations.quantity + EXCLUDED.quantity,
                updated_at = NOW();
        END IF;

    ELSIF NEW.movement_type = 'out' THEN
        IF src_location IS NULL THEN
            RAISE EXCEPTION 'from_location is required for outbound movement';
        END IF;

        UPDATE inventory_item_locations
        SET quantity = quantity - NEW.quantity, updated_at = NOW()
        WHERE item_id = NEW.item_id
          AND location = src_location
          AND quantity >= NEW.quantity;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient stock at location "%" for item %', src_location, NEW.item_id;
        END IF;

        DELETE FROM inventory_item_locations
        WHERE item_id = NEW.item_id
          AND location = src_location
          AND quantity = 0;

        UPDATE inventory_items
        SET current_stock = current_stock - NEW.quantity
        WHERE id = NEW.item_id
          AND current_stock >= NEW.quantity;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Insufficient overall stock for item %', NEW.item_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_stock ON stock_movements;
CREATE TRIGGER trigger_update_inventory_stock
    AFTER INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

ALTER TABLE inventory_item_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read inventory item locations" ON inventory_item_locations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Role-based inventory item locations write" ON inventory_item_locations
  FOR INSERT WITH CHECK (public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff'));

CREATE POLICY "Role-based inventory item locations update" ON inventory_item_locations
  FOR UPDATE USING (public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff'));
