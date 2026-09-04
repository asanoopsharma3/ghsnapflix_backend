-- MTN subscription batch + queue tables

CREATE TABLE IF NOT EXISTS mtn_subscription_batches (
  id BIGSERIAL PRIMARY KEY,
  original_filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mtn_batches_status ON mtn_subscription_batches (status);

CREATE TABLE IF NOT EXISTS mtn_subscription_queue (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES mtn_subscription_batches (id) ON DELETE CASCADE,
  msisdn VARCHAR(20) NOT NULL,
  transaction_id VARCHAR(8) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  status_code VARCHAR(20),
  status_message TEXT,
  amount_charged NUMERIC(10, 2) DEFAULT 0,
  response_payload JSONB,
  error_message TEXT,
  plan_id VARCHAR(50),
  subscription_misdn_id BIGINT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mtn_queue_status ON mtn_subscription_queue (status);
CREATE INDEX IF NOT EXISTS idx_mtn_queue_batch_id ON mtn_subscription_queue (batch_id);
CREATE INDEX IF NOT EXISTS idx_mtn_queue_batch_status ON mtn_subscription_queue (batch_id, status);

CREATE TABLE IF NOT EXISTS mtn_token_cache (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
