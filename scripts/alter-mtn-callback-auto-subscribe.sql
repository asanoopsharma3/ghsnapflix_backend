-- Callback auto-subscription: batch source, queue dedup, offset rotation state

ALTER TABLE mtn_subscription_batches
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'excel';

ALTER TABLE mtn_subscription_queue
  ADD COLUMN IF NOT EXISTS callback_transaction_id BIGINT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mtn_queue_callback_txn_id
  ON mtn_subscription_queue (callback_transaction_id)
  WHERE callback_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mtn_queue_callback_txn_lookup
  ON mtn_subscription_queue (callback_transaction_id);

CREATE TABLE IF NOT EXISTS mtn_callback_auto_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  offset_index SMALLINT NOT NULL DEFAULT 0,
  last_run_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO mtn_callback_auto_state (id, offset_index)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE mtn_callback_auto_state
  ADD COLUMN IF NOT EXISTS requested_plan_index SMALLINT NOT NULL DEFAULT 0;
