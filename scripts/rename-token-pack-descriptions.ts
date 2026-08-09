/**
 * One-time script: update token pack descriptions from 'DJT' to 'The Arena'
 * Searches by packId metadata so it works regardless of product name.
 * Run with: npx tsx scripts/rename-token-pack-descriptions.ts
 */
import { getUncachableStripeClient } from '../server/stripeClient';

const updates: { packId: string; description: string }[] = [
  { packId: 'pack_15', description: '15 extra prompts with The Arena' },
  { packId: 'pack_35', description: '35 extra prompts with The Arena - Popular!' },
  { packId: 'pack_80', description: '80 extra prompts with The Arena - Tremendous deal!' },
];

async function main() {
  const stripe = await getUncachableStripeClient();

  for (const update of updates) {
    const search = await stripe.products.search({
      query: `metadata['packId']:'${update.packId}' AND metadata['type']:'token_pack'`,
    });
    if (search.data.length === 0) {
      console.log(`⚠️  Not found: packId=${update.packId}`);
      continue;
    }
    const product = search.data[0];
    if (product.description === update.description) {
      console.log(`✓  Already up to date: ${product.name} (${update.packId})`);
      continue;
    }
    await stripe.products.update(product.id, { description: update.description });
    console.log(`✅ Updated: ${product.name} (${update.packId}) → "${update.description}"`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
