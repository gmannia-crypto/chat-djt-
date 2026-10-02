// Shared display catalog. Checkout still resolves and validates the pack on the server.
export const TOKEN_PACKS = [
  { id: "pack_15", tokens: 15, price: "$2.99", badge: null, description: "15 extra prompts with The Arena" },
  { id: "pack_35", tokens: 35, price: "$4.99", badge: "POPULAR", description: "35 extra prompts with The Arena - Popular!" },
  { id: "pack_80", tokens: 80, price: "$9.99", badge: "BEST VALUE", description: "80 extra prompts with The Arena - Tremendous deal!" },
] as const;

export type TokenPackId = (typeof TOKEN_PACKS)[number]["id"];