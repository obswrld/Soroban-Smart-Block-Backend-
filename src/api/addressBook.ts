import { translateAddress } from "../indexer/strkey-translator";

export type TagSource = "internal" | "db";
export interface AddressTag {
  address: string;
  name: string;
  source: TagSource;
}

// Internal directory of foundational ecosystem addresses. Extend as needed.
// Keys should be the canonical address used for lookup:
// - Contracts: C... contract strkeys
// - Wallets: G... ed25519 public keys (or resolved master keys for M...)
// - Special tokens: use short identifiers (e.g., "XLM_NATIVE")
const INTERNAL_DIRECTORY: Record<string, string> = {
  // Example known contracts / services
  // StellarSwap Router (seeded in prisma/seed.ts)
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA": "StellarSwap Router",

  // Example pool / AMM - placeholder
  // "CCW6...UX37": "StellarSwap Pool v1",

  // Example wallet / treasury addresses (replace with real if available)
  // "G...": "Stellar Foundation"

  // Special identifier for native token
  "XLM_NATIVE": "XLM (native)",
};

/**
 * Register a human-friendly name for an address at runtime (in-memory only).
 */
export function registerAddressName(address: string, name: string) {
  INTERNAL_DIRECTORY[address] = name;
}

/**
 * List all known addresses from the internal directory.
 */
export function listInternalDirectory() {
  return Object.keys(INTERNAL_DIRECTORY).map((k) => ({ address: k, name: INTERNAL_DIRECTORY[k] }));
}

/**
 * Resolve an arbitrary Stellar address (G/M/C) or identifier to a human-friendly name.
 *
 * Lookup order:
 *  1. Internal directory (fast, in-memory)
 *  2. Prisma contracts table (if @prisma/client is available and DB configured)
 *
 * Returns null if no name found.
 */
export async function getNameForAddress(rawAddressOrIdentifier: string): Promise<AddressTag | null> {
  if (!rawAddressOrIdentifier) return null;

  // Allow direct special identifiers (e.g., "XLM_NATIVE")
  if (INTERNAL_DIRECTORY[rawAddressOrIdentifier]) {
    return { address: rawAddressOrIdentifier, name: INTERNAL_DIRECTORY[rawAddressOrIdentifier], source: "internal" };
  }

  const translated = translateAddress(rawAddressOrIdentifier);

  // canonical key for lookup: contract addresses (C...) remain as-is; muxed -> masterKey; ed25519 -> masterKey
  let key: string;
  if (translated.kind === "contract" && translated.contractAddress) key = translated.contractAddress;
  else if (translated.kind === "muxed" && translated.masterKey) key = translated.masterKey;
  else if (translated.kind === "ed25519" && translated.masterKey) key = translated.masterKey;
  else key = translated.original;

  // 1) check internal directory
  if (INTERNAL_DIRECTORY[key]) {
    return { address: key, name: INTERNAL_DIRECTORY[key], source: "internal" };
  }

  // 2) try database lookup via Prisma if available (non-fatal)
  try {
    // dynamic require to avoid startup-time error if Prisma client not configured
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    try {
      // contract table contains known contract names seeded by prisma/seed.ts
      const c = await prisma.contract.findUnique({ where: { address: key } });
      if (c && c.name) {
        return { address: key, name: c.name, source: "db" };
      }
    } finally {
      await prisma.$disconnect();
    }
  } catch (err) {
    // ignore DB errors — service should still work with internal directory only
  }

  return null;
}
