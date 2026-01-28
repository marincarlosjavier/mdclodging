import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import {
  getPlans,
  getPlan,
  getSubscription,
  changePlan,
  cancelSubscription,
  reactivateSubscription,
  getCurrentUsage,
  checkQuotas,
  getSubscriptionHistory,
  hasFeatureAccess
} from '../services/subscription.service.js';
import {
  createCheckoutSession,
  createStripeSubscription
} from '../services/stripe.service.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/billing/plans
 * Get all available subscription plans
 */
router.get('/plans', asyncHandler(async (req, res) => {
  const plans = await getPlans(true); // Only active plans

  res.json({
    plans: plans.map(plan => ({
      ...plan,
      // Format prices for display
      price_monthly_formatted: `$${plan.price_monthly_cop.toLocaleString('es-CO')} COP`
    }))
  });
}));

/**
 * GET /api/billing/plans/:id
 * Get specific plan details
 */
router.get('/plans/:id', asyncHandler(async (req, res) => {
  const plan = await getPlan(req.params.id);

  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  res.json(plan);
}));

/**
 * GET /api/billing/subscription
 * Get current subscription for tenant
 */
router.get('/subscription', asyncHandler(async (req, res) => {
  const subscription = await getSubscription(req.tenantId);

  if (!subscription) {
    return res.status(404).json({
      error: 'No subscription found',
      message: 'Please contact support to activate your subscription'
    });
  }

  // Get current usage
  const usage = await getCurrentUsage(req.tenantId);

  // Check quotas
  const { quotaStatus, hasViolations, violations } = await checkQuotas(req.tenantId);

  // Calculate days remaining
  const now = new Date();
  const periodEnd = new Date(subscription.current_period_end);
  const daysRemaining = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));

  // Check if trial
  const isTrial = subscription.status === 'trialing';
  const trialEndsAt = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const trialDaysRemaining = trialEndsAt
    ? Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24))
    : 0;

  res.json({
    subscription: {
      ...subscription,
      days_remaining: daysRemaining,
      is_trial: isTrial,
      trial_days_remaining: trialDaysRemaining,
      will_cancel: subscription.cancel_at_period_end
    },
    usage,
    quotaStatus,
    hasViolations,
    violations,
    features: subscription.features
  });
}));

/**
 * POST /api/billing/subscription/change-plan
 * Upgrade or downgrade subscription plan
 */
router.post('/subscription/change-plan', requireAdmin, asyncHandler(async (req, res) => {
  const { planId } = req.body;

  if (!planId) {
    return res.status(400).json({ error: 'planId is required' });
  }

  const result = await changePlan(req.tenantId, planId, req.user.id);

  res.json({
    message: result.proration.isUpgrade ? 'Plan upgraded successfully' : 'Plan downgraded successfully',
    subscription: result.subscription,
    proration: result.proration
  });
}));

/**
 * POST /api/billing/subscription/cancel
 * Cancel subscription
 */
router.post('/subscription/cancel', requireAdmin, asyncHandler(async (req, res) => {
  const { immediate = false } = req.body;

  const subscription = await cancelSubscription(req.tenantId, immediate, req.user.id);

  res.json({
    message: immediate
      ? 'Subscription canceled immediately'
      : 'Subscription will cancel at the end of the current billing period',
    subscription
  });
}));

/**
 * POST /api/billing/subscription/reactivate
 * Reactivate a canceled subscription
 */
router.post('/subscription/reactivate', requireAdmin, asyncHandler(async (req, res) => {
  const subscription = await reactivateSubscription(req.tenantId, req.user.id);

  res.json({
    message: 'Subscription reactivated successfully',
    subscription
  });
}));

/**
 * GET /api/billing/usage
 * Get current usage statistics
 */
router.get('/usage', asyncHandler(async (req, res) => {
  const subscription = await getSubscription(req.tenantId);

  if (!subscription) {
    return res.status(404).json({ error: 'No subscription found' });
  }

  const usage = await getCurrentUsage(req.tenantId);

  res.json({
    usage,
    limits: {
      users: subscription.max_users,
      properties: subscription.max_properties,
      tasks_per_month: subscription.max_tasks_per_month,
      storage_mb: subscription.max_storage_mb
    }
  });
}));

/**
 * GET /api/billing/quotas
 * Check quota status
 */
router.get('/quotas', asyncHandler(async (req, res) => {
  const { quotaStatus, hasViolations, violations } = await checkQuotas(req.tenantId);

  res.json({
    quotaStatus,
    hasViolations,
    violations,
    message: hasViolations
      ? 'You have exceeded one or more plan limits. Please upgrade your plan.'
      : 'All quotas within limits'
  });
}));

/**
 * GET /api/billing/history
 * Get subscription history
 */
router.get('/history', requireAdmin, asyncHandler(async (req, res) => {
  const history = await getSubscriptionHistory(req.tenantId);

  res.json({
    history
  });
}));

/**
 * GET /api/billing/features/:feature
 * Check if tenant has access to a specific feature
 */
router.get('/features/:feature', asyncHandler(async (req, res) => {
  const { feature } = req.params;

  const hasAccess = await hasFeatureAccess(req.tenantId, feature);

  res.json({
    feature,
    hasAccess,
    message: hasAccess
      ? `Access granted to ${feature}`
      : `Your plan does not include ${feature}. Please upgrade to access this feature.`
  });
}));

/**
 * GET /api/billing/invoices
 * Get invoices for tenant
 */
router.get('/invoices', asyncHandler(async (req, res) => {
  // TODO: Implement invoice listing
  // For now, return empty array
  res.json({
    invoices: [],
    message: 'Invoice system coming soon'
  });
}));

/**
 * POST /api/billing/checkout
 * Create Stripe checkout session for plan upgrade
 */
router.post('/checkout', requireAdmin, asyncHandler(async (req, res) => {
  const { planId } = req.body;

  if (!planId) {
    return res.status(400).json({ error: 'planId is required' });
  }

  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: 'Payment processing not configured',
      message: 'Please contact support to upgrade your plan'
    });
  }

  const successUrl = `${process.env.APP_URL || 'http://localhost:5173'}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${process.env.APP_URL || 'http://localhost:5173'}/billing/plans`;

  const session = await createCheckoutSession(
    req.tenantId,
    planId,
    successUrl,
    cancelUrl
  );

  res.json({
    sessionId: session.id,
    url: session.url
  });
}));

/**
 * POST /api/billing/subscription/create
 * Create Stripe subscription with payment method
 */
router.post('/subscription/create', requireAdmin, asyncHandler(async (req, res) => {
  const { planId, paymentMethodId } = req.body;

  if (!planId || !paymentMethodId) {
    return res.status(400).json({
      error: 'planId and paymentMethodId are required'
    });
  }

  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: 'Payment processing not configured',
      message: 'Please contact support to upgrade your plan'
    });
  }

  const stripeSubscription = await createStripeSubscription(
    req.tenantId,
    planId,
    paymentMethodId
  );

  res.json({
    message: 'Subscription created successfully',
    subscription: stripeSubscription
  });
}));

export default router;
