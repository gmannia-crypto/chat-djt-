import { getStripeSync, getUncachableStripeClient } from './stripeClient';

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
  const isTherapy = meta.type === 'therapy';

  console.log(`[webhook] Payment successful: ${session.id} | amount: ${session.amount_total} | plan: ${meta.plan || 'unknown'}`);

  if (isTherapy) {
    console.log(`[webhook] Therapy purchase: plan=${meta.plan} | name=${meta.name || 'unknown'} | source=${meta.source || 'app'} | problem=${meta.problem || 'N/A'}`);
  }

  if (meta.deviceId) {
    console.log(`[webhook] Device: ${meta.deviceId} | tier: ${meta.tier || 'N/A'} | pack: ${meta.packId || 'N/A'}`);
  }
}

async function handleSubscriptionRenewal(invoice: any) {
  console.log(`[webhook] Subscription renewed: ${invoice.subscription} | amount: ${invoice.amount_paid} | customer: ${invoice.customer}`);
}
