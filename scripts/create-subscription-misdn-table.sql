-- subscription_misdns: MTN subscription API request/response log

CREATE TABLE IF NOT EXISTS subscription_misdns (
  id BIGSERIAL PRIMARY KEY,
  msisdn VARCHAR(20) NOT NULL,
  plan_id VARCHAR(50) NOT NULL,
  log_time TIMESTAMP NOT NULL,
  status_code VARCHAR(20),
  status_message TEXT,
  status TEXT,
  http_status VARCHAR(50),
  subscription_name VARCHAR(100),
  registration_channel VARCHAR(50),
  amount_charged NUMERIC(10, 2),
  send_sms_notification BOOLEAN,
  auto_renew BOOLEAN,
  amount_before NUMERIC(10, 2),
  amount_after NUMERIC(10, 2),
  non_gsm BOOLEAN,
  customer_id VARCHAR(20) NOT NULL,
  cvmoffer BOOLEAN,
  service_node VARCHAR(50),
  response_payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_misdns_msisdn ON subscription_misdns (msisdn);
CREATE INDEX IF NOT EXISTS idx_subscription_misdns_status_code ON subscription_misdns (status_code);

ALTER TABLE mtn_subscription_queue
  ADD COLUMN IF NOT EXISTS plan_id VARCHAR(50);

ALTER TABLE mtn_subscription_queue
  ADD COLUMN IF NOT EXISTS subscription_misdn_id BIGINT;
