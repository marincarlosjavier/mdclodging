-- Add Stripe-related fields to subscription system
-- This migration adds Stripe integration fields

-- Add stripe_price_id to subscription_plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price
ON subscription_plans(stripe_price_id);

-- Ensure stripe fields exist in subscriptions table
-- (These were already in migration 039, but adding IF NOT EXISTS for safety)
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub
ON subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
ON subscriptions(stripe_customer_id);

-- Add stripe fields to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS stripe_invoice_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice
ON invoices(stripe_invoice_id);

-- Add stripe fields to payment_methods table
ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe
ON payment_methods(stripe_payment_method_id);

-- Comments
COMMENT ON COLUMN subscription_plans.stripe_price_id IS 'Stripe Price ID for monthly billing';
COMMENT ON COLUMN subscription_plans.stripe_product_id IS 'Stripe Product ID';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Stripe Subscription ID';
COMMENT ON COLUMN subscriptions.stripe_customer_id IS 'Stripe Customer ID';
COMMENT ON COLUMN invoices.stripe_invoice_id IS 'Stripe Invoice ID';
COMMENT ON COLUMN invoices.stripe_payment_intent_id IS 'Stripe PaymentIntent ID';
COMMENT ON COLUMN payment_methods.stripe_payment_method_id IS 'Stripe PaymentMethod ID';
