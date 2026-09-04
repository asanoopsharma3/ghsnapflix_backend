-- Migrate subscription_misdns columns: drop legacy callback-style columns

ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS plan_id VARCHAR(50);
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS status_code VARCHAR(20);
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS status_message TEXT;
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS http_status VARCHAR(50);
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS subscription_name VARCHAR(100);
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS registration_channel VARCHAR(50);
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS amount_charged NUMERIC(10, 2);
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS send_sms_notification BOOLEAN;
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN;
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS amount_before NUMERIC(10, 2);
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS amount_after NUMERIC(10, 2);
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS non_gsm BOOLEAN;
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS customer_id VARCHAR(20);
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS service_node VARCHAR(50);
ALTER TABLE subscription_misdns ADD COLUMN IF NOT EXISTS response_payload JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_misdns' AND column_name = 'correlation_id'
  ) THEN
    ALTER TABLE subscription_misdns DROP COLUMN IF EXISTS correlation_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_misdns' AND column_name = 'transaction_id'
  ) THEN
    ALTER TABLE subscription_misdns DROP COLUMN IF EXISTS transaction_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_misdns' AND column_name = 'request_no'
  ) THEN
    ALTER TABLE subscription_misdns DROP COLUMN IF EXISTS request_no;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_misdns' AND column_name = 'requestNo'
  ) THEN
    ALTER TABLE subscription_misdns DROP COLUMN IF EXISTS "requestNo";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_misdns' AND column_name = 'serviceId'
  ) THEN
    UPDATE subscription_misdns
    SET plan_id = COALESCE(plan_id, "serviceId")
    WHERE plan_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_misdns' AND column_name = 'code'
  ) THEN
    UPDATE subscription_misdns
    SET status_code = COALESCE(status_code, code)
    WHERE status_code IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_misdns' AND column_name = 'result'
  ) THEN
    UPDATE subscription_misdns
    SET status_message = COALESCE(status_message, result)
    WHERE status_message IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_misdns' AND column_name = 'serviceNode'
  ) THEN
    UPDATE subscription_misdns
    SET service_node = COALESCE(service_node, "serviceNode")
    WHERE service_node IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_misdns' AND column_name = 'chargeAmount'
  ) THEN
    UPDATE subscription_misdns
    SET amount_charged = COALESCE(amount_charged, "chargeAmount")
    WHERE amount_charged IS NULL;
  END IF;

  UPDATE subscription_misdns
  SET customer_id = msisdn
  WHERE customer_id IS NULL AND msisdn IS NOT NULL;
END $$;

DROP INDEX IF EXISTS idx_subscription_misdns_request_no;
DROP INDEX IF EXISTS idx_subscription_misdns_transaction_id;
