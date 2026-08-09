#!/usr/bin/env npx tsx
/**
 * Renames old "Trump Tokens" Stripe products to use "Dynamic Tokens" branding.
 * Safe to run multiple times — skips products that already have correct names.
 */

import { getUncachableStripeClient } from "../server/stripeClient";

async function main() {
  const stripe = await getUncachableStripeClient();

  console.log("Fetching all Stripe products...\n");

  // Fetch all products (active and inactive)
  const allProducts: any[] = [];
  let hasMore = true;
  let startingAfter: string | undefined = undefined;

  while (hasMore) {
    const page = await stripe.products.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    allProducts.push(...page.data);
    hasMore = page.has_more;
    if (page.data.length > 0) {
      startingAfter = page.data[page.data.length - 1].id;
    }
  }

  console.log(`Found ${allProducts.length} total products.\n`);
  console.log("All products currently in Stripe:");
  allProducts.forEach((p: any) => {
    console.log(`  [${p.active ? "active" : "inactive"}] ${p.id}: "${p.name}"`);
  });
  console.log("");

  // Identify products with old branding
  const OLD_PATTERNS = [/trump token/i, /trump_token/i];
  const toRename = allProducts.filter((p: any) =>
    OLD_PATTERNS.some((re) => re.test(p.name))
  );

  if (toRename.length === 0) {
    console.log("✅ No products found with old 'Trump Tokens' branding. Nothing to rename.");
    return;
  }

  console.log(`Found ${toRename.length} product(s) to rename:\n`);
  for (const product of toRename) {
    const oldName = product.name as string;
    // Replace Trump Tokens / Trump Token with Dynamic Tokens / Dynamic Token
    const newName = oldName
      .replace(/Trump Tokens/gi, "Dynamic Tokens")
      .replace(/Trump Token/gi, "Dynamic Token");

    console.log(`  Renaming: "${oldName}" → "${newName}"`);
    console.log(`  Product ID: ${product.id}`);

    await stripe.products.update(product.id, { name: newName });
    console.log(`  ✅ Done\n`);
  }

  console.log("All renames complete.\n");
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
