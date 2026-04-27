-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255),
    "first_name" VARCHAR(100) NOT NULL DEFAULT '',
    "last_name" VARCHAR(100) NOT NULL DEFAULT '',
    "avatar_url" TEXT,
    "role_id" UUID,
    "department" VARCHAR(100),
    "location" VARCHAR(100),
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMPTZ(6),
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "parent_id" UUID,
    "created_by" UUID,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "contact_person" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "address" TEXT,
    "tax_id" VARCHAR(50),
    "payment_terms" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category_id" UUID,
    "unit_of_measure" VARCHAR(50) NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "selling_price" DECIMAL(10,2),
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "max_stock" INTEGER,
    "min_stock" INTEGER,
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "reserved_stock" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "image_url" TEXT,
    "barcode" VARCHAR(100),
    "location" VARCHAR(100),
    "created_by" UUID,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "po_number" VARCHAR(50) NOT NULL,
    "supplier_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "priority" VARCHAR(10) NOT NULL DEFAULT 'medium',
    "expected_delivery_date" DATE,
    "actual_delivery_date" DATE,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID,
    "approved_by" UUID,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "po_id" UUID,
    "item_id" UUID,
    "quantity_ordered" INTEGER NOT NULL,
    "quantity_received" INTEGER NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID,
    "movement_type" VARCHAR(20) NOT NULL,
    "reference_type" VARCHAR(20) NOT NULL,
    "reference_id" UUID,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_cost" DECIMAL(12,2),
    "from_location" VARCHAR(100),
    "to_location" VARCHAR(100),
    "notes" TEXT,
    "created_by" UUID,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transfer_number" VARCHAR(50) NOT NULL,
    "from_location" VARCHAR(100) NOT NULL,
    "to_location" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_by" UUID,
    "approved_by" UUID,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transfer_id" UUID,
    "item_id" UUID,
    "quantity" DECIMAL(12,3) NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "count_number" VARCHAR(50) NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    "notes" TEXT,
    "created_by" UUID,
    "approved_by" UUID,
    "start_date" TIMESTAMPTZ(6),
    "end_date" TIMESTAMPTZ(6),
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "count_id" UUID,
    "item_id" UUID,
    "system_quantity" INTEGER NOT NULL,
    "counted_quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "adjustment_number" VARCHAR(50) NOT NULL,
    "item_id" UUID,
    "adjustment_type" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "approved_by" UUID,
    "created_by" UUID,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "action_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "organization_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "table_name" VARCHAR(100),
    "record_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_conversions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "from_unit" VARCHAR(30) NOT NULL,
    "to_unit" VARCHAR(30) NOT NULL,
    "multiplier" DECIMAL(18,8) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_unit_conversions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "from_unit" VARCHAR(30) NOT NULL,
    "to_unit" VARCHAR(30) NOT NULL,
    "multiplier" DECIMAL(18,8) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "bom_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" VARCHAR(30),
    "required_base_qty" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_item_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receive_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_number" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "supplier_name" TEXT,
    "received_by_text" TEXT,
    "received_date" DATE,
    "location" TEXT,
    "attachment_path" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_by" UUID,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,
    "created_by" UUID,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receive_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receive_transaction_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receive_transaction_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "po_id" UUID,
    "po_line_id" UUID,
    "sku" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "description" TEXT,
    "unit_of_measure" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "line_cost" DECIMAL(12,2) NOT NULL,
    "condition_tag" TEXT NOT NULL,
    "issue_quantity" DECIMAL(12,3) NOT NULL,
    "issue_reason" TEXT,
    "issue_notes" TEXT,
    "location" TEXT,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receive_transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference_no" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "delivery_date" DATE NOT NULL,
    "tracking_number" TEXT,
    "delivery_confirmation" TEXT,
    "attachment_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_by" UUID,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,
    "created_by" UUID,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_request_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "delivery_request_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_of_measure" TEXT NOT NULL,
    "from_location" TEXT,
    "to_location" TEXT,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "production_number" TEXT NOT NULL,
    "bom_id" UUID NOT NULL,
    "finished_good_item_id" UUID NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "target_quantity" DECIMAL(14,4) NOT NULL,
    "output_unit" VARCHAR(30),
    "finished_good_base_qty" DECIMAL(14,4) NOT NULL,
    "add_finished_goods" BOOLEAN NOT NULL DEFAULT true,
    "required_components" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "failure_reason" TEXT,
    "created_by" UUID,
    "completed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "profiles_organization_id_idx" ON "profiles"("organization_id");

-- CreateIndex
CREATE INDEX "categories_organization_id_idx" ON "categories"("organization_id");

-- CreateIndex
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers"("organization_id");

-- CreateIndex
CREATE INDEX "inventory_items_organization_id_idx" ON "inventory_items"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_org_sku_unique" ON "inventory_items"("organization_id", "sku");

-- CreateIndex
CREATE INDEX "purchase_orders_organization_id_idx" ON "purchase_orders"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_org_po_number_unique" ON "purchase_orders"("organization_id", "po_number");

-- CreateIndex
CREATE INDEX "purchase_order_items_organization_id_idx" ON "purchase_order_items"("organization_id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_idx" ON "stock_movements"("organization_id");

-- CreateIndex
CREATE INDEX "stock_transfers_organization_id_idx" ON "stock_transfers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_org_transfer_number_unique" ON "stock_transfers"("organization_id", "transfer_number");

-- CreateIndex
CREATE INDEX "stock_transfer_items_organization_id_idx" ON "stock_transfer_items"("organization_id");

-- CreateIndex
CREATE INDEX "stock_counts_organization_id_idx" ON "stock_counts"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_org_count_number_unique" ON "stock_counts"("organization_id", "count_number");

-- CreateIndex
CREATE INDEX "stock_count_items_organization_id_idx" ON "stock_count_items"("organization_id");

-- CreateIndex
CREATE INDEX "stock_adjustments_organization_id_idx" ON "stock_adjustments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_org_adjustment_number_unique" ON "stock_adjustments"("organization_id", "adjustment_number");

-- CreateIndex
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_item_locations_item_id_location_key" ON "inventory_item_locations"("item_id", "location");

-- CreateIndex
CREATE UNIQUE INDEX "receive_transactions_organization_id_transaction_number_key" ON "receive_transactions"("organization_id", "transaction_number");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_requests_organization_id_reference_no_key" ON "delivery_requests"("organization_id", "reference_no");

-- CreateIndex
CREATE UNIQUE INDEX "production_runs_org_number_unique" ON "production_runs"("organization_id", "production_number");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
