-- CGW HE / Non-HE redirect + callback tables (TypeORM entities)

CREATE TABLE IF NOT EXISTS msisdn_logs (
  id BIGSERIAL PRIMARY KEY,
  msisdn VARCHAR(32),
  source VARCHAR(20) NOT NULL DEFAULT 'HE',
  offer_code VARCHAR(50),
  ip VARCHAR(128),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msisdn_logs_msisdn ON msisdn_logs (msisdn);

CREATE TABLE IF NOT EXISTS cgw_callbacks (
  id BIGSERIAL PRIMARY KEY,
  method VARCHAR(10),
  msisdn VARCHAR(32),
  offer_code VARCHAR(50),
  status VARCHAR(50),
  cgid VARCHAR(100),
  raw_query JSONB,
  raw_body JSONB,
  headers JSONB,
  ip VARCHAR(128),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cgw_callbacks_msisdn ON cgw_callbacks (msisdn);

CREATE TABLE IF NOT EXISTS cgw_callback_logs (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(10) NOT NULL DEFAULT 'CGW',
  method VARCHAR(10),
  msisdn VARCHAR(32),
  offer_code VARCHAR(50),
  status VARCHAR(50),
  lifecycle VARCHAR(100),
  reason TEXT,
  cgid VARCHAR(100),
  raw_query JSONB,
  raw_body JSONB,
  headers JSONB,
  ip VARCHAR(128),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cgw_callback_logs_msisdn ON cgw_callback_logs (msisdn);

CREATE TABLE IF NOT EXISTS ghana_callback_logs (
  id BIGSERIAL PRIMARY KEY,
  callback_type VARCHAR(10) NOT NULL,
  flow VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN',
  method VARCHAR(10),
  msisdn VARCHAR(32),
  offer_code VARCHAR(50),
  status VARCHAR(50),
  normalized_status VARCHAR(50),
  lifecycle VARCHAR(100),
  reason TEXT,
  cgid VARCHAR(100),
  charging_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  raw_query JSONB,
  raw_body JSONB,
  headers JSONB,
  ip VARCHAR(128),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghana_callback_logs_type ON ghana_callback_logs (callback_type);
CREATE INDEX IF NOT EXISTS idx_ghana_callback_logs_msisdn ON ghana_callback_logs (msisdn);

CREATE TABLE IF NOT EXISTS sdp_callbacks (
  id BIGSERIAL PRIMARY KEY,
  method VARCHAR(10),
  msisdn VARCHAR(32),
  transaction_id VARCHAR(200),
  offer_code VARCHAR(50),
  status VARCHAR(50),
  operator VARCHAR(50),
  operator_response JSONB,
  callback_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  payload_json JSONB,
  lifecycle VARCHAR(100),
  reason TEXT,
  raw_query JSONB,
  raw_body JSONB,
  headers JSONB,
  ip VARCHAR(128),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sdp_callbacks_msisdn ON sdp_callbacks (msisdn);
CREATE INDEX IF NOT EXISTS idx_sdp_callbacks_transaction_id ON sdp_callbacks (transaction_id);
CREATE INDEX IF NOT EXISTS idx_sdp_callbacks_timestamp ON sdp_callbacks (callback_timestamp);

CREATE TABLE IF NOT EXISTS sdp_logs (
  id BIGSERIAL PRIMARY KEY,
  method VARCHAR(10),
  external_service_id VARCHAR(100),
  request_id VARCHAR(200),
  request_timestamp VARCHAR(100),
  channel VARCHAR(50),
  feature_id VARCHAR(50),
  plan_id VARCHAR(50),
  command VARCHAR(50),
  msisdn VARCHAR(32),
  offer_code VARCHAR(50),
  charge_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subscription_status VARCHAR(50),
  subscriber_life_cycle VARCHAR(100),
  transaction_id VARCHAR(200),
  next_billing_date VARCHAR(50),
  reason TEXT,
  normalized_status VARCHAR(50),
  operator VARCHAR(50),
  callback_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  payload_json JSONB,
  raw_query JSONB,
  raw_body JSONB,
  headers JSONB,
  ip VARCHAR(128),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sdp_logs_request_id ON sdp_logs (request_id);
CREATE INDEX IF NOT EXISTS idx_sdp_logs_msisdn ON sdp_logs (msisdn);
CREATE INDEX IF NOT EXISTS idx_sdp_logs_transaction_id ON sdp_logs (transaction_id);
CREATE INDEX IF NOT EXISTS idx_sdp_logs_timestamp ON sdp_logs (callback_timestamp);

CREATE TABLE IF NOT EXISTS cgw_subscribers (
  id BIGSERIAL PRIMARY KEY,
  phone VARCHAR(32) NOT NULL UNIQUE,
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'inactive',
  is_attempt_quiz BOOLEAN NOT NULL DEFAULT FALSE,
  questions_played_today INTEGER NOT NULL DEFAULT 0,
  subscription_start_time TIMESTAMP,
  next_play_time TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cgw_subscribers_status ON cgw_subscribers (subscription_status);
