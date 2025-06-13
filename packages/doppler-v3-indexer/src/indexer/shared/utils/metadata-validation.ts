import { z } from 'zod';
import { isAddress } from 'viem';

// Token metadata validation schema
export const tokenMetadataSchema = z.object({
  name: z.string().min(3).max(50),
  symbol: z.string().min(2).max(8).regex(/^[A-Z0-9]+$/, {
    message: "Symbol can only contain uppercase letters and numbers",
  }),
  description: z.string().max(500).optional(),
  image: z.string(), // URL or IPFS hash
  creatorAddress: z.string().refine(isAddress, { message: "Invalid creator address" }).optional(),
  receiverAddress: z.string().refine(isAddress, { message: "Invalid receiver address" }).optional(),
  socials: z.object({
    twitter: z.string().optional(),
    telegram: z.string().optional(),
    website: z.string().optional(),
    discord: z.string().optional(),
  }).optional(),
});

export type TokenMetadata = z.infer<typeof tokenMetadataSchema>;

// Extract and normalize social fields from various metadata formats
export function extractSocials(rawMetadata: any): TokenMetadata['socials'] {
  if (!rawMetadata || typeof rawMetadata !== 'object') {
    return undefined;
  }

  const socials: TokenMetadata['socials'] = {};
  
  // Handle multiple field name variations
  socials.twitter = rawMetadata?.twitter || rawMetadata?.x || rawMetadata?.socials?.twitter || rawMetadata?.socials?.x;
  socials.telegram = rawMetadata?.telegram || rawMetadata?.socials?.telegram || rawMetadata?.tg;
  socials.website = rawMetadata?.website || rawMetadata?.url || rawMetadata?.socials?.website || rawMetadata?.web;
  socials.discord = rawMetadata?.discord || rawMetadata?.socials?.discord;
  
  // Clean up social fields
  if (socials.twitter && typeof socials.twitter === 'string') {
    // Remove @ symbol from Twitter handles
    if (!socials.twitter.startsWith('http')) {
      socials.twitter = socials.twitter.replace('@', '');
    }
  }
  
  // Remove empty fields
  Object.keys(socials).forEach(key => {
    const socialKey = key as keyof typeof socials;
    if (!socials[socialKey] || socials[socialKey] === '') {
      delete socials[socialKey];
    }
  });
  
  return Object.keys(socials).length > 0 ? socials : undefined;
}

// Validate and structure token metadata with fallbacks
export function validateTokenMetadata(
  rawMetadata: any,
  fallbacks: {
    name?: string;
    symbol?: string;
    creatorAddress?: string;
  } = {}
): { 
  validated: TokenMetadata | null; 
  isValid: boolean; 
  errors?: z.ZodError;
  structured: any;
} {
  if (!rawMetadata || typeof rawMetadata !== 'object') {
    return {
      validated: null,
      isValid: false,
      structured: rawMetadata,
    };
  }

  try {
    // Extract social fields
    const socials = extractSocials(rawMetadata);

    // Structure the metadata for validation
    const structured = {
      name: rawMetadata.name || fallbacks.name,
      symbol: rawMetadata.symbol || fallbacks.symbol,
      description: rawMetadata.description,
      image: rawMetadata.image || rawMetadata.image_hash || '',
      creatorAddress: rawMetadata.creatorAddress || fallbacks.creatorAddress,
      receiverAddress: rawMetadata.receiverAddress,
      ...(socials && { socials }),
    };

    // Validate the structured metadata
    const validated = tokenMetadataSchema.parse(structured);

    return {
      validated,
      isValid: true,
      structured,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Return structured data even if validation fails
      const structured = {
        ...rawMetadata,
        socials: extractSocials(rawMetadata),
      };

      return {
        validated: null,
        isValid: false,
        errors: error,
        structured,
      };
    }
    
    return {
      validated: null,
      isValid: false,
      structured: rawMetadata,
    };
  }
}

// Log validation results for monitoring
export function logValidationResult(
  tokenAddress: string,
  result: ReturnType<typeof validateTokenMetadata>
): void {
  if (result.isValid) {
    console.log(`[Metadata Validation] ✓ Token ${tokenAddress}: Valid metadata`);
  } else {
    console.warn(`[Metadata Validation] ✗ Token ${tokenAddress}: Invalid metadata`);
    if (result.errors) {
      console.warn(`[Metadata Validation] Errors:`, result.errors.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })));
    }
  }
}