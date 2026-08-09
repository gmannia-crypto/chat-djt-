#!/usr/bin/env node
/**
 * Renames old "Trump Tokens" Stripe products to use "Dynamic Tokens" branding.
 * Safe to run multiple times — skips products that already have correct names.
 */

const path = require("path");

// We need to load the Stripe client using the Replit connector
async function main() {
  // Dynamically import the compiled stripeClient (or use the source via ts-node)
  // We'll call the Replit connector API directly using the same approach as stripeClient.ts
  const { getUncachableStripeClient } = await import(
    path.join(process.cwd(), "server/stripeClient.ts")
  ).catch(() =>
    // Fallback: try the compiled version
    require(path.join(process.cwd(), "dist/stripeClient.js"))
  );

  const stripe = await getUncachableStripeClient();

  console.log("Fetching all Stripe products...\n");

  // Fetch all products (active and inactive)
  const allProducts = [];
  let hasMore = true;
  let startingAfter = undefined;

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

  // Identify products with old branding
  const OLD_PATTERNS = [/trump token/i, /trump_token/i];
  const toRename = allProducts.filter((p) =>
    OLD_PATTERNS.some((re) => re.test(p.name))
  );

  if (toRename.length === 0) {
    console.log("✅ No products found with old 'Trump Tokens' branding.");
    console.log("\nAll products currently in Stripe:");
    allProducts.forEach((p) => {
      console.log(`  [${p.active ? "active" : "inactive"}] ${p.id}: "${p.name}"`);
    });
    return;
  }

  console.log(`Found ${toRename.length} product(s) to rename:\n`);
  for (const product of toRename) {
    const oldName = product.name;
    // Replace Trump Tokens / Trump Token with Dynamic Tokens / Dynamic Token
    const newName = oldName
      .replace(/Trump Tokens/gi, "Dynamic Tokens")
      .replace(/Trump Token/gi, "Dynamic Token");

    console.log(`  Renaming: "${oldName}" → "${newName}"`);
    console.log(`  Product ID: ${product.id}`);

    await stripe.products.update(product.id, { name: newName });
    console.log(`  ✅ Done\n`);
  }

  console.log("All renames complete. Verifying...\n");

  // Verify
  const verifyProducts = await stripe.products.list({ limit: 100 });
  console.log("Current product names:");
  verifyProducts.data.forEach((p) => {
    console.log(`  [${p.active ? "active" : "inactive"}] ${p.id}: "${p.name}"`);
  });
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
