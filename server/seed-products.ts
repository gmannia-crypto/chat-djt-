import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.products.search({ query: "name:'Chat DJT Premium'" });
  if (existing.data.length > 0) {
    console.log('Chat DJT Premium already exists:', existing.data[0].id);
    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    if (prices.data.length > 0) {
      console.log('Price:', prices.data[0].id, '$' + (prices.data[0].unit_amount! / 100).toFixed(2) + '/month');
    }
    return;
  }

  const product = await stripe.products.create({
    name: 'Chat DJT Premium',
    description: 'Unlimited chats with the greatest AI president ever. Believe me, nobody does it better!',
    metadata: {
      app: 'chatdjt',
      tier: 'premium',
    },
  });

  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 299,
    currency: 'usd',
    recurring: { interval: 'month' },
  });

  console.log('Product created:', product.id);
  console.log('Monthly price created:', monthlyPrice.id, '- $2.99/month');
}

createProducts().catch(console.error);
