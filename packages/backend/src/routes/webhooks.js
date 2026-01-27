import express from 'express';
import { verifyWebhookSignature, handleStripeWebhook } from '../services/stripe.service.js';
import { logger } from '../config/logger.js';

const router = express.Router();

/**
 * Stripe webhook endpoint
 * IMPORTANT: This endpoint must use express.raw() to preserve the raw body
 * for signature verification
 */
router.post('/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    try {
      // Verify webhook signature
      const event = verifyWebhookSignature(req.body, sig);

      logger.info('Stripe webhook received', {
        type: event.type,
        id: event.id
      });

      // Handle the event
      await handleStripeWebhook(event);

      // Return success response
      res.json({ received: true });
    } catch (err) {
      logger.error('Webhook signature verification failed', {
        error: err.message,
        signature: sig
      });

      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

export default router;
