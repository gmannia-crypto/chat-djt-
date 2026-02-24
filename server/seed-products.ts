import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  const subscriptionTiers = [
    {
      name: 'Chat DJT Premium',
      description: 'Unlimited ratings, video responses, leaderboard name, custom roasts. The premium experience!',
      metadata: { app: 'chatdjt', tier: 'premium', type: 'subscription' },
      price: 399,
    },
    {
      name: 'Chat DJT Standard',
      description: '50 Trump Tokens per month. Great deal!',
      metadata: { app: 'chatdjt', tier: 'standard', type: 'subscription' },
      price: 499,
    },
    {
      name: 'Chat DJT VIP',
      description: '150 Trump Tokens per month. The best deal, believe me! Tremendous value!',
      metadata: { app: 'chatdjt', tier: 'vip', type: 'subscription' },
      price: 999,
    },
  ];

  for (const tier of subscriptionTiers) {
    const existing = await stripe.products.search({ query: `name:'${tier.name}'` });
    let product;
    if (existing.data.length > 0) {
      product = existing.data[0];
      console.log(`${tier.name} already exists:`, product.id);
    } else {
      product = await stripe.products.create({
        name: tier.name,
        description: tier.description,
        metadata: tier.metadata,
      });
      console.log(`${tier.name} created:`, product.id);
    }

    const existingPrices = await stripe.prices.list({ product: product.id, active: true });
    if (existingPrices.data.length === 0) {
      const monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: tier.price,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      console.log(`  Price created: ${monthlyPrice.id} - $${(tier.price / 100).toFixed(2)}/month`);
    } else {
      console.log(`  Price exists: ${existingPrices.data[0].id}`);
    }
  }

  const tokenPacks = [
    { name: '15 Trump Tokens', amount: 299, packId: 'pack_15', description: '15 extra prompts with DJT' },
    { name: '35 Trump Tokens', amount: 499, packId: 'pack_35', description: '35 extra prompts with DJT - Popular!' },
    { name: '80 Trump Tokens', amount: 999, packId: 'pack_80', description: '80 extra prompts with DJT - Tremendous deal!' },
  ];

  for (const pack of tokenPacks) {
    const search = await stripe.products.search({ query: `name:'${pack.name}'` });
    if (search.data.length > 0) {
      console.log(`${pack.name} already exists:`, search.data[0].id);
      continue;
    }

    const product = await stripe.products.create({
      name: pack.name,
      description: pack.description,
      metadata: { app: 'chatdjt', type: 'token_pack', packId: pack.packId },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: pack.amount,
      currency: 'usd',
    });

    console.log(`${pack.name} created: product=${product.id}, price=${price.id} - $${(pack.amount / 100).toFixed(2)}`);
  }

  console.log('\nAll products ready!');
}

createProducts().catch(console.error);
