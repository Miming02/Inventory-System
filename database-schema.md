# Database Schema - The Fluid Curator Inventory System
**Database:** PostgreSQL  
**Backend:** Supabase  
**Version:** 1.1  

**Source of truth (DDL + RLS):** `backend/supabase/migrations/001_inventory_setup.sql` (keep this document aligned when migrations change).  
**Related:** `docs/SYSTEM_REQUIREMENTS.md`, `docs/SYSTEM_ARCHITECTURE.md`.

---

## 📋 Overview
This schema supports a complete inventory management system with role-based access control, purchase orders, stock movements, and audit trails. **Authentication** is handled by **Supabase Auth** (`auth.users`). Application-specific user fields live in **`public.profiles`** with `profiles.id` = `auth.users.id`.

---

## 🔐 Authentication & User Management

### 1. Supabase Auth (`auth.users`)
Managed by Supabase (not declared in `public`). Holds credentials, email confirmation state, and encrypted password material. **Do not** duplicate password hashes in `public` tables.

### 2. `roles` Table
```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. `profiles` Table (application user row)
Created for each auth signup via trigger `on_auth_user_created` → `handle_new_user()`.

```sql
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
```

### Sessions
Sessions and refresh tokens are managed by **Supabase Auth** (no separate `user_sessions` table in the current migration).

---

## 📦 Inventory Management

### 4. `categories` Table
```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. `suppliers` Table
```sql
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
```

### 6. `inventory_items` Table
```sql
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
```

---

## 📋 Purchase Orders

### 7. `purchase_orders` Table
```sql
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
```

### 8. `purchase_order_items` Table
```sql
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
```

---

## 📦 Stock Movements

### 9. `stock_movements` Table
```sql
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES inventory_items(id),
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'transfer', 'adjustment')),
    reference_type VARCHAR(20) NOT NULL CHECK (reference_type IN ('purchase', 'sale', 'transfer', 'adjustment', 'disposal', 'return')),
    reference_id UUID, -- References PO, transfer, etc.
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10,2),
    from_location VARCHAR(100),
    to_location VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 10. `stock_transfers` Table
```sql
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
```

### 11. `stock_transfer_items` Table
```sql
CREATE TABLE stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID REFERENCES stock_transfers(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📊 Stock Counts & Adjustments

### 12. `stock_counts` Table
```sql
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
```

### 13. `stock_count_items` Table
```sql
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
```

### 14. `stock_adjustments` Table
```sql
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
```

---

## 🔔 Notifications & Audit

### 15. `notifications` Table
```sql
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
```

### 16. `audit_logs` Table
```sql
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
```

---

## 🎯 Indexes for Performance

```sql
-- Profiles
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role_id);
CREATE INDEX idx_profiles_active ON profiles(is_active);

-- Inventory
CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX idx_inventory_items_active ON inventory_items(is_active);
CREATE INDEX idx_inventory_items_stock ON inventory_items(current_stock);

-- Purchase Orders
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_created ON purchase_orders(created_at);

-- Stock Movements
CREATE INDEX idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);

-- Audit Logs
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

---

## 🔐 Row Level Security (RLS) Policies for Supabase

Policies use `public.current_role_name()` (join `profiles` → `roles`) unless noted. Full verbatim SQL: see migration file.

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read roles" ON roles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (public.current_role_name() = 'Admin');

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (public.current_role_name() = 'Admin');

CREATE POLICY "Authenticated can read inventory" ON inventory_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Role-based inventory write" ON inventory_items
  FOR INSERT WITH CHECK (public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff'));

CREATE POLICY "Role-based inventory update" ON inventory_items
  FOR UPDATE USING (public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Procurement Staff'));

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

CREATE POLICY "Stock movements read by ops roles" ON stock_movements
  FOR SELECT USING (public.current_role_name() IN ('Admin', 'Warehouse Staff', 'Management', 'Procurement Staff'));

CREATE POLICY "Stock movements write by warehouse/admin" ON stock_movements
  FOR INSERT WITH CHECK (public.current_role_name() IN ('Admin', 'Warehouse Staff'));
```

---

## 🔄 Triggers for Data Integrity

```sql
-- Update inventory stock when stock movement occurs
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

CREATE TRIGGER trigger_update_inventory_stock
    AFTER INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION update_inventory_stock();

-- Audit logging trigger (matches migration: COALESCE for user_id when unavailable)
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

-- Apply audit trigger to key tables (see migration for full list)
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_inventory_items AFTER INSERT OR UPDATE OR DELETE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

---

## 📊 Initial Data

### Default Roles
```sql
INSERT INTO roles (name, description, permissions) VALUES
('Admin', 'Full system access', '["*"]'),
('Management', 'View reports and monitor operations', '["view:reports", "view:inventory", "view:users"]'),
('Warehouse Staff', 'Handle receiving, movement, and dispatch', '["manage:inventory", "view:reports"]'),
('Procurement Staff', 'Manage suppliers and purchase orders', '["manage:procurement", "manage:suppliers", "view:inventory"]'),
('Production Staff', 'Request and consume items', '["request:items", "view:inventory"]');
```

---

## 🚀 Supabase Integration Notes

### 1. **Authentication**
- Use Supabase Auth for credentials and sessions (`auth.users`).
- **`public.profiles`** extends identity with app fields and `role_id`; JWT is the Supabase access token (role is resolved server-side for RLS via `profiles` + `roles`, not embedded as custom JWT claims in the default setup).

### 2. **Real-time Subscriptions**
- Enable real-time updates for inventory levels
- Live notifications for low stock
- Real-time purchase order status updates

### 3. **File Storage**
- Use Supabase Storage for:
  - Product images
  - User avatars
  - Document attachments

### 4. **Edge Functions**
- **`invite-user`:** Admin-only invite-by-email; updates `profiles` role (see `supabase/functions/invite-user/index.ts`).
- **Future:** email notifications, report generation, or heavy orchestration not suitable in the browser.

---

## 📈 Performance Considerations

1. **Partitioning**: Consider partitioning large tables by date (audit_logs, stock_movements)
2. **Materialized Views**: Create views for complex reporting queries
3. **Caching**: Use Supabase Edge Functions for frequently accessed data
4. **Connection Pooling**: Configure appropriate pool size for your traffic

---

## 🔒 Security Best Practices

1. **Input Validation**: All inputs validated at application level
2. **SQL Injection Prevention**: Use parameterized queries
3. **Data Encryption**: Sensitive data encrypted at rest
4. **Access Control**: Row Level Security for all user data
5. **Audit Trail**: Complete audit log for all changes

This schema provides a solid foundation for your inventory management system with PostgreSQL and Supabase integration.
