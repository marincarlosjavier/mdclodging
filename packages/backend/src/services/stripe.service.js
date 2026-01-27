import Stripe from 'stripe';
import { pool } from '../config/database.js';
import { getSubscription, getPlan } from './subscription.service.js';
import { logger } from '../config/logger.js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/**
 * Create a Stripe customer for a tenant
 * @param {Object} tenant - Tenant object
 * @returns {Promise<Object>} - Stripe customer
 */
export async function createStripeCustomer(tenant) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const customer = await stripe.customers.create({
    email: tenant.email || `tenant-${tenant.id}@mdclodging.com`,
    name: tenant.name,
    metadata: {
      tenant_id: tenant.id.toString(),
      subdomain: tenant.subdomain
    }
  });

  await pool.query(
    'UPDATE subscriptions SET stripe_customer_id = $1 WHERE tenant_id = $2',
    [customer.id, tenant.id]
  );

  logger.info('Stripe customer created', {
    tenantId: tenant.id,
    stripeCustomerId: customer.id
  });

  return customer;
}

/**
 * Create a Stripe subscription
 * @param {number} tenantId - Tenant ID
 * @param {number} planId - Plan ID
 * @param {string} paymentMethodId - Stripe payment method ID
 * @returns {Promise<Object>} - Stripe subscription
 */
export async function createStripeSubscription(tenantId, planId, paymentMethodId) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const subscription = await getSubscription(tenantId);
  const plan = await getPlan(planId);

  if (!subscription) {
    throw new Error('No subscription found for tenant');
  }

  if (!plan.stripe_price_id) {
    throw new Error('Plan does not have a Stripe price ID configured');
  }

  // Ensure customer exists
  let customerId = subscription.stripe_customer_id;
  if (!customerId) {
    const tenant = await pool.query(
      'SELECT * FROM tenants WHERE id = $1',
      [tenantId]
    );
    const customer = await createStripeCustomer(tenant.rows[0]);
    customerId = customer.id;
  }

  const stripeSubscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: plan.stripe_price_id }],
    default_payment_method: paymentMethodId,
    currency: 'cop',
    metadata: {
      tenant_id: tenantId.toString(),
      plan_id: planId.toString()
    },
    expand: ['latest_invoice.payment_intent']
  });

  await pool.query(
    'UPDATE subscriptions SET stripe_subscription_id = $1, status = $2 WHERE tenant_id = $3',
    [stripeSubscription.id, stripeSubscription.status, tenantId]
  );

  logger.info('Stripe subscription created', {
    tenantId,
    stripeSubscriptionId: stripeSubscription.id,
    planId
  });

  return stripeSubscription;
}

/**
 * Create a checkout session for plan upgrade
 * @param {number} tenantId - Tenant ID
 * @param {number} planId - Plan ID to upgrade to
 * @param {string} successUrl - Success redirect URL
 * @param {string} cancelUrl - Cancel redirect URL
 * @returns {Promise<Object>} - Stripe checkout session
 */
export async function createCheckoutSession(tenantId, planId, successUrl, cancelUrl) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const subscription = await getSubscription(tenantId);
  const plan = await getPlan(planId);

  if (!plan.stripe_price_id) {
    throw new Error('Plan does not have a Stripe price ID configured');
  }

  // Ensure customer exists
  let customerId = subscription.stripe_customer_id;
  if (!customerId) {
    const tenant = await pool.query(
      'SELECT * FROM tenants WHERE id = $1',
      [tenantId]
    );
    const customer = await createStripeCustomer(tenant.rows[0]);
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: plan.stripe_price_id,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      tenant_id: tenantId.toString(),
      plan_id: planId.toString()
    }
  });

  logger.info('Checkout session created', {
    tenantId,
    planId,
    sessionId: session.id
  });

  return session;
}

/**
 * Handle Stripe webhook events
 * @param {Object} event - Stripe event
 * @returns {Promise<void>}
 */
export async function handleStripeWebhook(event) {
  logger.info('Processing Stripe webhook', { type: event.type });

  try {
    switch (event.type) {
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      default:
        logger.info('Unhandled webhook event type', { type: event.type });
    }
  } catch (error) {
    logger.error('Error handling webhook', {
      type: event.type,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Handle successful invoice payment
 * @param {Object} invoice - Stripe invoice
 */
async function handleInvoicePaid(invoice) {
  const tenantId = invoice.metadata?.tenant_id;

  if (!tenantId) {
    logger.warn('Invoice paid but no tenant_id in metadata', {
      invoiceId: invoice.id
    });
    return;
  }

  await pool.query(
    `UPDATE subscriptions
     SET status = 'active', updated_at = NOW()
     WHERE tenant_id = $1`,
    [parseInt(tenantId)]
  );

  await pool.query(
    `UPDATE invoices
     SET status = 'paid', paid_at = NOW(), updated_at = NOW()
     WHERE stripe_invoice_id = $1`,
    [invoice.id]
  );

  logger.info('Invoice marked as paid', {
    tenantId,
    invoiceId: invoice.id,
    amount: invoice.amount_paid
  });
}

/**
 * Handle failed invoice payment
 * @param {Object} invoice - Stripe invoice
 */
async function handlePaymentFailed(invoice) {
  const tenantId = invoice.metadata?.tenant_id;

  if (!tenantId) {
    logger.warn('Payment failed but no tenant_id in metadata', {
      invoiceId: invoice.id
    });
    return;
  }

  await pool.query(
    `UPDATE subscriptions
     SET status = 'past_due', updated_at = NOW()
     WHERE tenant_id = $1`,
    [parseInt(tenantId)]
  );

  await pool.query(
    `UPDATE invoices
     SET status = 'open', updated_at = NOW()
     WHERE stripe_invoice_id = $1`,
    [invoice.id]
  );

  logger.warn('Payment failed', {
    tenantId,
    invoiceId: invoice.id,
    attemptCount: invoice.attempt_count
  });

  // TODO: Send notification email to tenant
}

/**
 * Handle subscription cancellation
 * @param {Object} subscription - Stripe subscription
 */
async function handleSubscriptionCanceled(subscription) {
  const tenantId = subscription.metadata?.tenant_id;

  if (!tenantId) {
    logger.warn('Subscription canceled but no tenant_id in metadata', {
      subscriptionId: subscription.id
    });
    return;
  }

  await pool.query(
    `UPDATE subscriptions
     SET status = 'canceled',
         canceled_at = NOW(),
         updated_at = NOW()
     WHERE tenant_id = $1`,
    [parseInt(tenantId)]
  );

  logger.info('Subscription canceled', {
    tenantId,
    stripeSubscriptionId: subscription.id
  });
}

/**
 * Handle subscription updates
 * @param {Object} subscription - Stripe subscription
 */
async function handleSubscriptionUpdated(subscription) {
  const tenantId = subscription.metadata?.tenant_id;

  if (!tenantId) {
    logger.warn('Subscription updated but no tenant_id in metadata', {
      subscriptionId: subscription.id
    });
    return;
  }

  await pool.query(
    `UPDATE subscriptions
     SET status = $1,
         current_period_start = to_timestamp($2),
         current_period_end = to_timestamp($3),
         updated_at = NOW()
     WHERE tenant_id = $4`,
    [
      subscription.status,
      subscription.current_period_start,
      subscription.current_period_end,
      parseInt(tenantId)
    ]
  );

  logger.info('Subscription updated', {
    tenantId,
    status: subscription.status
  });
}

/**
 * Handle subscription creation
 * @param {Object} subscription - Stripe subscription
 */
async function handleSubscriptionCreated(subscription) {
  const tenantId = subscription.metadata?.tenant_id;

  if (!tenantId) {
    logger.warn('Subscription created but no tenant_id in metadata', {
      subscriptionId: subscription.id
    });
    return;
  }

  await pool.query(
    `UPDATE subscriptions
     SET stripe_subscription_id = $1,
         status = $2,
         current_period_start = to_timestamp($3),
         current_period_end = to_timestamp($4),
         updated_at = NOW()
     WHERE tenant_id = $5`,
    [
      subscription.id,
      subscription.status,
      subscription.current_period_start,
      subscription.current_period_end,
      parseInt(tenantId)
    ]
  );

  logger.info('Subscription created in Stripe', {
    tenantId,
    stripeSubscriptionId: subscription.id
  });
}

/**
 * Cancel a Stripe subscription
 * @param {number} tenantId - Tenant ID
 * @param {boolean} immediate - Cancel immediately or at period end
 * @returns {Promise<Object>} - Stripe subscription
 */
export async function cancelStripeSubscription(tenantId, immediate = false) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const subscription = await getSubscription(tenantId);

  if (!subscription.stripe_subscription_id) {
    throw new Error('No Stripe subscription found for tenant');
  }

  const stripeSubscription = immediate
    ? await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
    : await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true
      });

  logger.info('Stripe subscription canceled', {
    tenantId,
    immediate,
    stripeSubscriptionId: subscription.stripe_subscription_id
  });

  return stripeSubscription;
}

/**
 * Verify Stripe webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {Object} - Verified Stripe event
 */
export function verifyWebhookSignature(payload, signature) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
