import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.products.search({ query: "name:'Chat DJT Premium'" });
  let premiumProduct;
  if (existing.data.length > 0) {
    premiumProduct = existing.data[0];
    console.log('Chat DJT Premium already exists:', premiumProduct.id);
  } else {
    premiumProduct = await stripe.products.create({
      name: 'Chat DJT Premium',
      description: '30 Trump Tokens per month. The best deal, believe me!',
      metadata: { app: 'chatdjt', tier: 'premium', type: 'subscription' },
    });
    console.log('Premium product created:', premiumProduct.id);
  }

  const existingPrices = await stripe.prices.list({ product: premiumProduct.id, active: true });
  if (existingPrices.data.length === 0) {
    const monthlyPrice = await stripe.prices.create({
      product: premiumProduct.id,
      unit_amount: 299,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log('Monthly price created:', monthlyPrice.id, '- $2.99/month');
  } else {
    console.log('Monthly price exists:', existingPrices.data[0].id);
  }

  const tokenPacks = [
    { name: '10 Trump Tokens', amount: 199, packId: 'pack_10', description: '10 extra prompts with DJT' },
    { name: '25 Trump Tokens', amount: 399, packId: 'pack_25', description: '25 extra prompts with DJT - Best value!' },
    { name: '50 Trump Tokens', amount: 699, packId: 'pack_50', description: '50 extra prompts with DJT - Tremendous deal!' },
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
