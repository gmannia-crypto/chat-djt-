import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { grantTokenPack, grantSubscriptionTokens } from './tokens';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. '
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const stripe = await getUncachableStripeClient();
      const webhookSecret = (sync as any).webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) return;

      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );

      switch (event.type) {
        case 'checkout.session.completed':
          await handleSuccessfulPayment(event.data.object as any);
          break;
        case 'invoice.payment_succeeded':
          await handleSubscriptionRenewal(event.data.object as any);
          break;
      }
    } catch (err: any) {
      console.error('[webhook] Custom handler error (non-critical):', err.message);
    }
  }
}

async function handleSuccessfulPayment(session: any) {
  const meta = session.metadata || {};

  console.log(`[webhook] Payment successful: ${session.id} | amount: ${session.amount_total} | mode: ${session.mode}`);

  if (meta.deviceId && meta.packId) {
    try {
      const balance = await grantTokenPack(meta.deviceId, meta.packId, session.id);
      console.log(`[webhook] Token pack granted via webhook: device=${meta.deviceId} pack=${meta.packId} balance=${JSON.stringify(balance)}`);
    } catch (err: any) {
      console.error(`[webhook] Failed to grant token pack: ${err.message}`);
    }
  }

  if (meta.deviceId && session.mode === 'subscription' && session.subscription) {
    try {
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || '';
      const tier = (meta.tier === 'vip' ? 'vip' : 'standard') as 'standard' | 'vip';
      const balance = await grantSubscriptionTokens(meta.deviceId, customerId, subId, tier, session.id);
      console.log(`[webhook] Subscription granted via webhook: device=${meta.deviceId} tier=${tier} balance=${JSON.stringify(balance)}`);
    } catch (err: any) {
      console.error(`[webhook] Failed to grant subscription: ${err.message}`);
    }
  }

  if (meta.type === 'therapy') {
    console.log(`[webhook] Therapy purchase: plan=${meta.plan} | name=${meta.name || 'unknown'} | source=${meta.source || 'app'}`);
  }
}

async function handleSubscriptionRenewal(invoice: any) {
  console.log(`[webhook] Subscription renewed: ${invoice.subscription} | amount: ${invoice.amount_paid} | customer: ${invoice.customer}`);
}
