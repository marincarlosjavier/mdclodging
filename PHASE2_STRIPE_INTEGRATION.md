# Phase 2 - Stripe Integration Complete ✅

## Overview
Implemented comprehensive Stripe payment integration for SaaS subscription billing.

## Files Created

### 1. `packages/backend/src/services/stripe.service.js`
Complete Stripe service with:
- Customer creation and management
- Subscription creation with payment methods
- Checkout session creation for upgrades
- Webhook event handling (invoice.paid, payment_failed, subscription updates)
- Subscription cancellation

**Key Functions:**
- `createStripeCustomer(tenant)` - Creates Stripe customer for tenant
- `createStripeSubscription(tenantId, planId, paymentMethodId)` - Creates paid subscription
- `createCheckoutSession(tenantId, planId, successUrl, cancelUrl)` - Creates checkout UI
- `handleStripeWebhook(event)` - Processes webhook events
- `cancelStripeSubscription(tenantId, immediate)` - Cancels subscription
- `verifyWebhookSignature(payload, signature)` - Validates webhook authenticity

### 2. `packages/backend/src/routes/webhooks.js`
Webhook endpoint handler:
- Route: `POST /webhooks/stripe`
- Verifies Stripe signature
- Processes subscription lifecycle events
- **CRITICAL:** Must come BEFORE body parser middleware (needs raw body)

### 3. `packages/backend/src/database/migrations/040_add_stripe_fields.sql`
Database schema updates:
- Added `stripe_price_id` and `stripe_product_id` to `subscription_plans`
- Ensured `stripe_subscription_id` and `stripe_customer_id` in `subscriptions`
- Added `stripe_invoice_id` and `stripe_payment_intent_id` to `invoices`
- Added `stripe_payment_method_id` to `payment_methods`
- Created indexes for all Stripe fields

### 4. `packages/backend/src/database/run-single-migration.js`
Utility script for running individual migrations (workaround for migration tracking issue)

## Files Modified

### `packages/backend/src/app.js`
- Imported `webhookRoutes`
- Registered `/webhooks` route **BEFORE** body parser (critical for Stripe signature verification)
- Added webhooks endpoint to API info

### `packages/backend/src/routes/billing.js`
Added new endpoints:
- `POST /api/billing/checkout` - Create Stripe checkout session
- `POST /api/billing/subscription/create` - Create subscription with payment method
- Imported Stripe service functions

### `packages/backend/.env.example`
- Moved Stripe variables from "Optional" to dedicated section
- Added `APP_URL` for redirect URLs
- Added documentation for getting Stripe keys

## Configuration Required

### Environment Variables
Add to your `.env` file:

```env
# Application URL
APP_URL=http://localhost:5173

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_PUBLISHABLE_KEY=pk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Getting Stripe Keys
1. **API Keys**: https://dashboard.stripe.com/apikeys
   - Use test keys (`sk_test_...`, `pk_test_...`) for development
   - Switch to live keys (`sk_live_...`, `pk_live_...`) for production

2. **Webhook Secret**: https://dashboard.stripe.com/webhooks
   - Create webhook endpoint: `https://your-domain.com/webhooks/stripe`
   - Select events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*`
   - Copy signing secret (`whsec_...`)

### Setting Up Stripe Products
You need to create products and prices in Stripe dashboard for each plan:

1. Go to: https://dashboard.stripe.com/products
2. Create 4 products matching your plans:
   - **Trial Plan** (Free) - No Stripe product needed
   - **Basic Plan** - $149,000 COP/month
   - **Pro Plan** - $349,000 COP/month
   - **Enterprise Plan** - $999,000 COP/month

3. For each product, create a recurring price in COP
4. Copy the Price ID (starts with `price_...`)
5. Update database with Price IDs:

```sql
UPDATE subscription_plans
SET stripe_price_id = 'price_1ABC...'
WHERE name = 'basic';

UPDATE subscription_plans
SET stripe_price_id = 'price_1DEF...'
WHERE name = 'pro';

UPDATE subscription_plans
SET stripe_price_id = 'price_1GHI...'
WHERE name = 'enterprise';
```

## API Endpoints

### Payment Processing

#### Create Checkout Session
```bash
POST /api/billing/checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "planId": 2
}

Response:
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

#### Create Subscription Directly
```bash
POST /api/billing/subscription/create
Authorization: Bearer <token>

{
  "planId": 2,
  "paymentMethodId": "pm_..."
}
```

### Webhook Endpoint
```bash
POST /webhooks/stripe
Stripe-Signature: t=...,v1=...

{
  "type": "invoice.paid",
  "data": { ... }
}
```

## Webhook Event Handling

The system automatically handles these Stripe events:

| Event | Action |
|-------|--------|
| `invoice.paid` | Set subscription to `active`, mark invoice as paid |
| `invoice.payment_failed` | Set subscription to `past_due`, keep invoice open |
| `customer.subscription.deleted` | Set subscription to `canceled` |
| `customer.subscription.updated` | Update subscription status and period dates |
| `customer.subscription.created` | Link Stripe subscription ID to local subscription |

## Payment Flow

### 1. Checkout Flow (Recommended)
User clicks "Upgrade" → API creates checkout session → User redirected to Stripe → Payment → Webhook confirms → Subscription activated

```javascript
// Frontend
const response = await fetch('/api/billing/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ planId: 2 })
});
const { url } = await response.json();
window.location.href = url; // Redirect to Stripe
```

### 2. Direct Payment Method (Advanced)
Collect payment method with Stripe Elements → Create subscription with payment method

## Testing Webhooks Locally

### Option 1: Stripe CLI (Recommended)
```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/webhooks/stripe

# Copy the webhook signing secret (whsec_...)
# Add to .env as STRIPE_WEBHOOK_SECRET
```

### Option 2: ngrok
```bash
# Install ngrok
# https://ngrok.com/

# Expose local server
ngrok http 3000

# Use ngrok URL in Stripe dashboard
# Example: https://abc123.ngrok.io/webhooks/stripe
```

## Security Considerations

✅ **Implemented:**
- Webhook signature verification (prevents fake webhooks)
- Raw body parsing for webhooks (required for signature)
- Stripe customer metadata includes tenant_id
- All payment routes require admin authentication

⚠️ **Important:**
- Never expose `STRIPE_SECRET_KEY` in frontend code
- Always verify webhook signatures
- Use test keys in development
- Rotate API keys if compromised

## Testing with Stripe Test Cards

Use these test cards in Stripe checkout:

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Payment declined |
| `4000 0025 0000 3155` | Requires authentication (3D Secure) |

**Test Card Details:**
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

## Known Limitations

1. **Migration Tracking:** Migration script runs all migrations sequentially. For production, implement proper migration tracking table.

2. **Stripe Product Setup:** Requires manual setup of products/prices in Stripe dashboard and database updates.

3. **Invoice PDF Generation:** Not yet implemented (placeholder endpoint exists).

4. **Email Notifications:** Payment failure emails not yet implemented (TODO in webhook handler).

5. **Proration:** Calculated in `subscription.service.js` but not yet integrated with Stripe billing.

## Next Steps (Phase 2 Remaining)

- **Section 2.3:** Quota Enforcement Middleware
  - Block API calls when limits exceeded
  - Enforce user, property, task quotas in real-time

- **Section 2.4:** Admin Dashboard API
  - Platform-wide tenant management
  - Revenue metrics (MRR, churn)
  - Suspend/reactivate tenants

## Troubleshooting

### Webhook Not Working
1. Check webhook secret is correct in `.env`
2. Verify webhook endpoint is accessible (not localhost in production)
3. Check webhook route is registered BEFORE body parser
4. Verify Stripe signature in logs

### Payment Not Creating Subscription
1. Check plan has `stripe_price_id` set
2. Verify Stripe customer was created
3. Check webhook events are being delivered
4. Review audit logs for errors

### Database Connection Issues
1. Ensure DATABASE_URL is correct
2. Check PostgreSQL is running
3. Verify migrations have been applied

## Validation Checklist

- [x] Stripe SDK installed
- [x] Stripe service created with all webhook handlers
- [x] Webhook routes registered BEFORE body parser
- [x] Migration 040 applied (Stripe fields added)
- [x] Billing routes updated with checkout endpoints
- [x] Environment variables documented
- [ ] Stripe products created in dashboard (manual step)
- [ ] Stripe price IDs added to database (manual step)
- [ ] Webhook endpoint configured in Stripe dashboard (manual step)
- [ ] Test payment flow verified (requires Stripe setup)

## Status: ✅ IMPLEMENTATION COMPLETE

Stripe integration code is complete and ready for testing once Stripe account is configured with products and webhook endpoints.

**Estimated Time:** 4 hours actual (16 hours planned)

**Next Phase:** Section 2.3 - Quota Enforcement Middleware
