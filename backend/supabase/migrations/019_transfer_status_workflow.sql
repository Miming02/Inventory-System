-- Transfer workflow statuses:
-- draft -> pending_approval -> requested -> transferred / cancelled
ALTER TABLE public.stock_transfers
  DROP CONSTRAINT IF EXISTS stock_transfers_status_check;

ALTER TABLE public.stock_transfers
  ADD CONSTRAINT stock_transfers_status_check
  CHECK (
    status IN (
      'draft',
      'pending_approval',
      'requested',
      'transferred',
      'cancelled',
      'pending',
      'in_transit',
      'completed'
    )
  );
