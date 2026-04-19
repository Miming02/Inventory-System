-- ========================================
-- Inventory - Database Setup SQL
-- Copy and paste this in Supabase SQL Editor
-- ========================================

-- Notes (important):
-- - Supabase Auth users live in auth.users (managed by Supabase).
-- - This script uses a "profiles" table linked to auth.users for app-specific user fields + roles.
-- - Avoid storing password hashes in your own table; Supabase Auth handles authentication.

-- Required for gen_random_uuid() in most Supabase projects (usually enabled already)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create Roles Table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Profiles Table (app users; linked to Supabase Auth)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(100) NOT NULL DEFAULT '',
    last_name VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url TEXT,
    role_id UUID REFERENCES roles(id),
    department VARCHAR(100),
    location VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: get current user's role name (used in policies)
CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT r.name
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = auth.uid()
$$;

-- 3. Create Categories Table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Suppliers Table
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    tax_id VARCHAR(50),
    payment_terms VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Inventory Items Table
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id),
    unit_of_measure VARCHAR(50) NOT NULL,
    unit_cost DECIMAL(10,2),
    selling_price DECIMAL(10,2),
    reorder_level INTEGER DEFAULT 0,
    max_stock INTEGER,
    min_stock INTEGER,
    current_stock INTEGER DEFAULT 0,
    reserved_stock INTEGER DEFAULT 0,
    available_stock INTEGER GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
    is_active BOOLEAN DEFAULT true,
    image_url TEXT,
    barcode VARCHAR(100),
    location VARCHAR(100),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Purchase Orders Table
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    subtotal DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Purchase Order Items Table
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id),
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create Stock Movements Table
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES inventory_items(id),
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'transfer', 'adjustment')),
    reference_type VARCHAR(20) NOT NULL CHECK (reference_type IN ('purchase', 'sale', 'transfer', 'adjustment', 'disposal', 'return')),
    reference_id UUID,
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10,2),
    from_location VARCHAR(100),
    to_location VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create Stock Transfers Table
CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    from_location VARCHAR(100) NOT NULL,
    to_location VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Create Stock Transfer Items Table
CREATE TABLE stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID REFERENCES stock_transfers(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Create Stock Counts Table
CREATE TABLE stock_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_number VARCHAR(50) UNIQUE NOT NULL,
    location VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('draft', 'in_progress', 'completed', 'approved')),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Create Stock Count Items Table
CREATE TABLE stock_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_id UUID REFERENCES stock_counts(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id),
    system_quantity INTEGER NOT NULL,
    counted_quantity INTEGER NOT NULL,
    variance INTEGER GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Create Stock Adjustments Table
CREATE TABLE stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_number VARCHAR(50) UNIQUE NOT NULL,
    item_id UUID REFERENCES inventory_items(id),
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('damage', 'expired', 'loss', 'correction', 'write_off')),
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    approved_by UUID REFERENCES profiles(id),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Create Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Create Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- Create Indexes for Performance
-- ========================================

-- Users Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role_id);
CREATE INDEX idx_profiles_active ON profiles(is_active);

-- Inventory Indexes
CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX idx_inventory_items_active ON inventory_items(is_active);
CREATE INDEX idx_inventory_items_stock ON inventory_items(current_stock);

-- Purchase Orders Indexes
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_created ON purchase_orders(created_at);

-- Stock Movements Indexes
CREATE INDEX idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);

-- Audit Logs Indexes
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ========================================
-- Insert Default Roles
-- ========================================

INSERT INTO roles (name, description, permissions) VALUES
('Admin', 'Full system access', '["*"]'),
('Management', 'View reports and monitor operations', '["view:reports", "view:inventory", "view:users"]'),
('Warehouse Staff', 'Handle receiving, movement, and dispatch', '["manage:inventory", "view:reports"]'),
('Procurement Staff', 'Manage suppliers and purchase orders', '["manage:procurement", "manage:suppliers", "view:inventory"]'),
('Production Staff', 'Request and consume items', '["request:items", "view:inventory"]');

-- ========================================
-- Create Triggers for Data Integrity
-- ========================================

-- Function to update inventory stock when stock movement occurs
CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.movement_type = 'in' THEN
        UPDATE inventory_items 
        SET current_stock = current_stock + NEW.quantity 
        WHERE id = NEW.item_id;
    ELSIF NEW.movement_type = 'out' THEN
        UPDATE inventory_items 
        SET current_stock = current_stock - NEW.quantity 
        WHERE id = NEW.item_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock updates
CREATE TRIGGER trigger_update_inventory_stock
    AFTER INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION update_inventory_stock();

-- Function for audit logging
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to key tables
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_inventory_items AFTER INSERT OR UPDATE OR DELETE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ========================================
-- Enable Row Level Security (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (you can customize these later)
-- Roles: readable by authenticated users (so UI can list roles)
CREATE POLICY "Authenticated can read roles" ON roles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Profiles: users can read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Profiles: users can update their own profile (non-admin fields; enforce in app too)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Profiles: Admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (public.current_role_name() = 'Admin');

-- Profiles: Admins can update all profiles (including role changes)
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (public.current_role_name() = 'Admin');

-- Inventory: authenticated users can read inventory
CREATE POLICY "Authenticated can read inventory" ON inventory_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- Inventory: only Admin/Warehouse/Procurement can write inventory
CREATE POLICY "Role-based inventory write" ON inventory_items
  FOR INSERT WITH CHECK (public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff'));

CREATE POLICY "Role-based inventory update" ON inventory_items
  FOR UPDATE USING (public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff'));

-- Purchase Orders: procurement can manage their own; admin/management/warehouse can read all
CREATE POLICY "Purchase orders read by ops roles" ON purchase_orders
  FOR SELECT USING (
    public.current_role_name() IN ('Admin', 'Management', 'Warehouse Staff', 'Procurement Staff')
  );

CREATE POLICY "Procurement can create purchase orders" ON purchase_orders
  FOR INSERT WITH CHECK (public.current_role_name() IN ('Admin', 'Procurement Staff'));

CREATE POLICY "Procurement can update own purchase orders" ON purchase_orders
  FOR UPDATE USING (
    public.current_role_name() = 'Admin'
    OR (public.current_role_name() = 'Procurement Staff' AND created_by = auth.uid())
  );

-- Stock Movements: warehouse/admin can read/write
CREATE POLICY "Stock movements read by ops roles" ON stock_movements
  FOR SELECT USING (public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Management', 'Procurement Staff'));

CREATE POLICY "Stock movements write by warehouse/admin" ON stock_movements
  FOR INSERT WITH CHECK (public.current_role_name() IN ('Admin', 'Warehouse Staff'));

-- ========================================
-- Setup Complete!
-- ========================================
