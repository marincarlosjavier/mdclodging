# 💳 Stripe Setup Guide (When Ready)

Complete guide for configuring Stripe payment processing on MDCLodging.

**Status:** Optional - Configure when ready to accept payments
**Time Required:** 30-45 minutes
**Prerequisites:** Stripe account, production deployment complete

---

## Why Stripe?

Stripe provides:
- Credit/debit card processing
- Recurring subscription billing
- Automatic invoicing
- Webhook notifications
- Colombian Peso (COP) support
- PCI compliance

---

## Step 1: Create Stripe Account

### 1.1 Sign Up
1. Go to: https://dashboard.stripe.com/register
2. Fill in business details
3. Verify email
4. Complete business verification

### 1.2 Choose Test or Live Mode
**Toggle:** Top-right corner of dashboard

- **Test Mode:** For development/testing (use test cards)
- **Live Mode:** For real payments (requires business verification)

**Recommendation:** Complete all setup in Test Mode first, then switch to Live Mode

---

## Step 2: Get API Keys

### 2.1 Retrieve Keys
1. Go to: **Developers → API keys**
2. Copy both keys:
   - **Publishable key:** `pk_test_...` (safe for frontend)
   - **Secret key:** `sk_test_...` (MUST keep secret)

### 2.2 Save Keys Securely
```bash
# On your local machine - DO NOT COMMIT TO GIT
echo "STRIPE_SECRET_KEY=sk_test_..." >> .env.local
echo "STRIPE_PUBLISHABLE_KEY=pk_test_..." >> .env.local
```

---

## Step 3: Create Products

### 3.1 Create Basic Plan
1. Go to: **Products → Add product**
2. Fill in:
   - **Name:** Plan Básico
   - **Description:** Ideal para pequeñas propiedades
   - **Pricing:** Recurring
   - **Price:** 149,000 COP per month
   - **Currency:** COP (Colombian Peso)
   - **Billing period:** Monthly
3. Click **Save product**
4. **Copy Price ID:** `price_...` (starts with "price_")

### 3.2 Create Pro Plan
1. **Products → Add product**
2. Fill in:
   - **Name:** Plan Profesional
   - **Description:** Para administradores con múltiples propiedades
   - **Pricing:** Recurring
   - **Price:** 349,000 COP per month
   - **Currency:** COP
   - **Billing period:** Monthly
3. **Save and copy Price ID**

### 3.3 Create Enterprise Plan
1. **Products → Add product**
2. Fill in:
   - **Name:** Plan Empresarial
   - **Description:** Solución completa para grandes empresas
   - **Pricing:** Recurring
   - **Price:** 999,000 COP per month
   - **Currency:** COP
   - **Billing period:** Monthly
3. **Save and copy Price ID**

### 3.4 Optional: Create Yearly Pricing
For each product:
1. Click product → **Add another price**
2. Set yearly price (typically 12 months - 2 months)
3. Save and copy Price ID

---

## Step 4: Update Database with Price IDs

### 4.1 Connect to Database
```bash
# On the server
ssh deploy@YOUR_SERVER_IP
cd /opt/mdclodging

# Connect to PostgreSQL
psql "$DATABASE_URL"
```

### 4.2 Update Basic Plan
```sql
UPDATE subscription_plans
SET
  stripe_price_id = 'price_XXXXXXXXXXXXX',  -- Your actual Price ID
  stripe_product_id = 'prod_XXXXXXXXXXXXX'  -- Optional: Product ID
WHERE name = 'basic';
```

### 4.3 Update Pro Plan
```sql
UPDATE subscription_plans
SET
  stripe_price_id = 'price_XXXXXXXXXXXXX',
  stripe_product_id = 'prod_XXXXXXXXXXXXX'
WHERE name = 'pro';
```

### 4.4 Update Enterprise Plan
```sql
UPDATE subscription_plans
SET
  stripe_price_id = 'price_XXXXXXXXXXXXX',
  stripe_product_id = 'prod_XXXXXXXXXXXXX'
WHERE name = 'enterprise';
```

### 4.5 Verify Update
```sql
SELECT name, display_name, price_monthly_cop, stripe_price_id
FROM subscription_plans
WHERE name IN ('basic', 'pro', 'enterprise');
```

Should show all Price IDs filled in.

```sql
-- Exit
\q
```

---

## Step 5: Configure Webhook

### 5.1 Create Webhook Endpoint
1. Go to: **Developers → Webhooks**
2. Click **Add endpoint**
3. **Endpoint URL:** `https://api.yourdomain.com/webhooks/stripe`
4. **Events to send:**
   - Select: `invoice.paid`
   - Select: `invoice.payment_failed`
   - Select: `customer.subscription.created`
   - Select: `customer.subscription.updated`
   - Select: `customer.subscription.deleted`

   **Or** click "Select all invoice events" and "Select all customer.subscription events"

5. Click **Add endpoint**

### 5.2 Get Webhook Signing Secret
1. Click on the webhook you just created
2. **Reveal** the Signing secret
3. Copy: `whsec_...`

---

## Step 6: Update Environment Variables

### 6.1 On Server
```bash
# On the server
ssh deploy@YOUR_SERVER_IP
cd /opt/mdclodging/packages/backend

# Edit .env
nano .env
```

### 6.2 Add Stripe Configuration
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51XXXXXXXXXXXXXXXXXXXXXXXX
STRIPE_PUBLISHABLE_KEY=pk_test_51XXXXXXXXXXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXX

# App URL (should already be set)
APP_URL=https://app.yourdomain.com
```

**Save:** Ctrl+O, Enter, Ctrl+X

### 6.3 Restart Backend
```bash
cd /opt/mdclodging
docker compose -f docker-compose.prod.yml restart backend

# Check logs
docker logs mdclodging_backend -f
```

Should see backend start successfully with no Stripe errors.

---

## Step 7: Test Payment Flow (Test Mode)

### 7.1 Test Card Numbers
Stripe provides test cards:

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Payment declined |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |

**For all test cards:**
- **Expiry:** Any future date (e.g., 12/34)
- **CVC:** Any 3 digits (e.g., 123)
- **ZIP:** Any 5 digits (e.g., 12345)

### 7.2 Create Test Checkout
```bash
# On your local machine
curl -X POST https://api.yourdomain.com/api/billing/checkout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": 2
  }'
```

Response should include:
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

### 7.3 Complete Test Payment
1. Open the `url` from response in browser
2. Use test card: `4242 4242 4242 4242`
3. Complete payment
4. You'll be redirected to success URL

### 7.4 Verify Webhook Received
1. Go to: **Stripe Dashboard → Developers → Webhooks**
2. Click your webhook endpoint
3. Check **Recent events**
4. Should see: `invoice.paid` event

### 7.5 Verify Database Updated
```bash
# On the server
psql "$DATABASE_URL"
```

```sql
-- Check subscription was created/updated
SELECT id, tenant_id, status, stripe_subscription_id
FROM subscriptions
ORDER BY updated_at DESC
LIMIT 5;

-- Should show subscription with status 'active' and stripe_subscription_id
```

---

## Step 8: Test Webhook Locally (Optional)

### 8.1 Install Stripe CLI
```bash
# On your local machine (Windows)
# Download from: https://github.com/stripe/stripe-cli/releases

# Or use Chocolatey
choco install stripe-cli

# Or use Scoop
scoop install stripe
```

### 8.2 Login to Stripe
```bash
stripe login
# Follow browser instructions
```

### 8.3 Forward Webhooks to Local
```bash
# Forward webhooks to local server
stripe listen --forward-to localhost:3000/webhooks/stripe

# Copy the webhook signing secret (whsec_...)
# Add to your local .env file
```

### 8.4 Trigger Test Events
```bash
# Trigger a successful payment event
stripe trigger invoice.paid

# Trigger a failed payment event
stripe trigger invoice.payment_failed
```

Check your local backend logs to see events being processed.

---

## Step 9: Switch to Live Mode

### 9.1 Complete Stripe Verification
1. Go to: **Settings → Account details**
2. Complete business information
3. Add bank account for payouts
4. Submit for verification (may take 1-3 business days)

### 9.2 Get Live API Keys
1. Switch to **Live Mode** (toggle top-right)
2. Go to: **Developers → API keys**
3. Copy **LIVE** keys:
   - `pk_live_...`
   - `sk_live_...`

### 9.3 Create Live Webhook
1. **Developers → Webhooks → Add endpoint**
2. URL: `https://api.yourdomain.com/webhooks/stripe`
3. Select same events as test mode
4. Copy live webhook secret: `whsec_...`

### 9.4 Update Production Environment
```bash
# On the server
ssh deploy@YOUR_SERVER_IP
cd /opt/mdclodging/packages/backend

nano .env
```

**Replace test keys with live keys:**
```env
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXXXXXXXXXX
STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXX
```

**Save and restart:**
```bash
cd /opt/mdclodging
docker compose -f docker-compose.prod.yml restart backend
```

### 9.5 Update Frontend (if applicable)
If you're passing publishable key to frontend:
```bash
# On the server
cd /opt/mdclodging/packages/frontend

# Update build-time env
echo "VITE_STRIPE_PUBLISHABLE_KEY=pk_live_..." >> .env

# Rebuild
npm run build

# Restart
cd /opt/mdclodging
docker compose -f docker-compose.prod.yml restart frontend
```

---

## Step 10: Test Live Payment

⚠️ **WARNING:** This will create a REAL charge!

### 10.1 Create Real Checkout Session
Use the same API call as Step 7.2, but with live mode enabled.

### 10.2 Complete Payment with Real Card
1. Open checkout URL
2. Use a real credit card
3. Complete payment
4. Verify charge in Stripe Dashboard

### 10.3 Request Refund (if test)
1. **Stripe Dashboard → Payments**
2. Click the test payment
3. Click **Refund**
4. Confirm refund

---

## Step 11: Monitor Payments

### 11.1 Stripe Dashboard
- **Payments:** All transactions
- **Subscriptions:** Active subscriptions
- **Customers:** Customer list
- **Invoices:** Generated invoices

### 11.2 Application Monitoring
```bash
# On the server
# View Stripe webhook events in logs
docker logs mdclodging_backend | grep "Stripe webhook"

# Check subscription status
psql "$DATABASE_URL" -c "
  SELECT t.name, s.status, sp.display_name, s.stripe_subscription_id
  FROM subscriptions s
  JOIN tenants t ON t.id = s.tenant_id
  JOIN subscription_plans sp ON sp.id = s.plan_id
  ORDER BY s.updated_at DESC
  LIMIT 10;
"
```

### 11.3 Grafana Metrics
Open Grafana (`http://YOUR_SERVER_IP:3002`) and check:
- `mdclodging_stripe_events_total` - Webhook events
- `mdclodging_mrr_cop` - Monthly recurring revenue
- `mdclodging_subscriptions` - Subscription counts

---

## Troubleshooting

### Webhook not receiving events
```bash
# Check webhook endpoint is accessible
curl -X POST https://api.yourdomain.com/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{}'

# Should return 400 (not 404)

# Check Stripe webhook logs
# Stripe Dashboard → Webhooks → Your endpoint → Recent events
```

### Payment fails with "No such price"
- Verify Price ID in database matches Stripe
- Check you're using correct mode (test vs live)
- Ensure currency is COP

### Subscription not updating in database
```bash
# Check backend logs for errors
docker logs mdclodging_backend | grep -i stripe

# Check webhook secret is correct
# Verify tenant_id is in webhook metadata
```

### Customer can't complete payment
- Check card details are valid
- Verify 3D Secure if required
- Check Stripe radar rules aren't blocking payment
- Verify business is approved for international payments

---

## Security Best Practices

### ✅ Do's
- ✅ Always verify webhook signatures
- ✅ Use HTTPS for all API calls
- ✅ Store secret key in environment variables
- ✅ Log all payment events
- ✅ Test in Test Mode first
- ✅ Use Stripe's official libraries

### ❌ Don'ts
- ❌ Never commit API keys to git
- ❌ Never expose secret key in frontend
- ❌ Don't skip webhook signature verification
- ❌ Don't store full card numbers
- ❌ Don't process payments without SSL

---

## Stripe Fees

### Colombia
- **Credit Card:** 3.49% + $700 COP per transaction
- **International Cards:** 3.99% + $700 COP
- **Disputes:** 60,000 COP per dispute

### Payout Schedule
- **Default:** Every 2 business days
- **Can adjust:** Daily or weekly

---

## Going Live Checklist

- [ ] Business verified by Stripe
- [ ] Bank account added for payouts
- [ ] All products created with correct prices
- [ ] Database updated with live Price IDs
- [ ] Live API keys configured
- [ ] Live webhook configured and tested
- [ ] Test payment completed successfully
- [ ] Monitoring configured
- [ ] Customer support email ready
- [ ] Terms of service updated
- [ ] Privacy policy includes payment info

---

## Support

### Stripe Support
- **Email:** support@stripe.com
- **Phone:** Available for verified accounts
- **Docs:** https://stripe.com/docs

### Stripe Status
Check service status: https://status.stripe.com/

### MDCLodging Logs
```bash
# Backend logs
docker logs mdclodging_backend -f

# Webhook events
docker logs mdclodging_backend | grep "webhook"

# Payment errors
docker logs mdclodging_backend | grep -i "stripe.*error"
```

---

## Next Steps After Stripe Setup

1. **Test Complete User Flow:**
   - User registration
   - Trial period
   - Upgrade to paid
   - Payment processing
   - Subscription renewal

2. **Configure Email Notifications:**
   - Payment successful
   - Payment failed
   - Subscription ending
   - Upgrade confirmation

3. **Setup Customer Portal:**
   - Allow customers to manage subscriptions
   - Update payment methods
   - View invoices

4. **Monitor Revenue:**
   - Daily MRR tracking
   - Churn rate analysis
   - Failed payment recovery

---

**Stripe Setup Status:** ✅ COMPLETE
**Ready for:** Customer payments and subscriptions 💰
