-- MTN request transactionid: 8-char hex, unique per request

ALTER TABLE mtn_subscription_queue
  ALTER COLUMN transaction_id TYPE VARCHAR(8)
  USING LEFT(transaction_id, 8);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mtn_queue_transaction_id
  ON mtn_subscription_queue (transaction_id);
