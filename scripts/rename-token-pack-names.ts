/**
 * One-time script: rename token pack product names from 'Trump Tokens' to 'Dynamic Tokens'
 * Searches by packId metadata so it works regardless of current product name.
 * Legacy packs (10, 25, 50) are archived after renaming.
 * Run with: npx tsx scripts/rename-token-pack-names.ts
 */
import { getUncachableStripeClient } from '../server/stripeClient';

const activePacks: { packId: string; name: string }[] = [
  { packId: 'pack_15', name: '15 Dynamic Tokens' },
  { packId: 'pack_35', name: '35 Dynamic Tokens' },
  { packId: 'pack_80', name: '80 Dynamic Tokens' },
];

const legacyPacks: { packId: string; name: string }[] = [
  { packId: 'pack_10', name: '10 Dynamic Tokens' },
  { packId: 'pack_25', name: '25 Dynamic Tokens' },
  { packId: 'pack_50', name: '50 Dynamic Tokens' },
];

async function main() {
  const stripe = await getUncachableStripeClient();

  console.log('=== Renaming active token packs ===');
  for (const pack of activePacks) {
    const search = await stripe.products.search({
      query: `metadata['packId']:'${pack.packId}' AND metadata['type']:'token_pack'`,
    });
    if (search.data.length === 0) {
      console.log(`⚠️  Not found: packId=${pack.packId}`);
      continue;
    }
    const product = search.data[0];
    if (product.name === pack.name) {
      console.log(`✓  Already up to date: ${product.name} (${pack.packId})`);
      continue;
    }
    await stripe.products.update(product.id, { name: pack.name });
    console.log(`✅ Renamed: "${product.name}" → "${pack.name}" (${pack.packId})`);
  }

  console.log('\n=== Renaming and archiving legacy token packs ===');
  for (const pack of legacyPacks) {
    const search = await stripe.products.search({
      query: `metadata['packId']:'${pack.packId}' AND metadata['type']:'token_pack'`,
    });
    if (search.data.length === 0) {
      console.log(`✓  Not found (already gone): packId=${pack.packId}`);
      continue;
    }
    const product = search.data[0];
    const updates: Record<string, unknown> = {};
    if (product.name !== pack.name) {
      updates.name = pack.name;
    }
    if (product.active) {
      updates.active = false;
    }
    if (Object.keys(updates).length === 0) {
      console.log(`✓  Already renamed and archived: ${product.name} (${pack.packId})`);
      continue;
    }
    await stripe.products.update(product.id, updates as Parameters<typeof stripe.products.update>[1]);
    const actions = [
      updates.name ? `renamed to "${pack.name}"` : null,
      updates.active === false ? 'archived' : null,
    ].filter(Boolean).join(' and ');
    console.log(`✅ ${actions}: "${product.name}" (${pack.packId})`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
