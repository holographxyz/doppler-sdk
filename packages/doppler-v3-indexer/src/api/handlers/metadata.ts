import PinataSDK from '@pinata/sdk';
import { z } from 'zod';
import type { Context } from 'hono';
import { isAddress } from "viem";

// Initialize Pinata
const pinata = new PinataSDK(
  process.env.PINATA_API_KEY!,
  process.env.PINATA_API_SECRET!
);

// Enhanced validation schema matching PRD specs
const metadataSchema = z.object({
  name: z.string().min(3).max(50),
  symbol: z.string().min(2).max(8).regex(/^[A-Z0-9]+$/, {
    message: "Ticker can only contain uppercase letters and numbers",
  }),
  description: z.string().max(500).optional(),
  image: z.string(), // URL or IPFS hash
  createdAddress: z.string().refine(isAddress, { message: "Invalid fee receiver address" }).optional(),
  receiverAddress:  z.string().refine(isAddress, { message: "Invalid fee receiver address" }).optional(),
  socials: z.object({
    twitter: z.string().optional(),
    telegram: z.string().optional(),
    website: z.string().optional(),
    discord: z.string().optional(),
  }).optional(),
});

export async function createTokenMetadata(c: Context) {
  try {
    // 1. Parse and validate request body
    const body = await c.req.json();
    const validated = metadataSchema.parse(body);

    // 2. Create metadata object with createdBy field
    const metadata = {
      name: validated.name,
      symbol: validated.symbol,
      description: validated.description,
      image: validated.image,
      socials: validated.socials || {},
      createdBy: validated.createdAddress,
      receiverAddress: validated.receiverAddress,
    };

    // 3. Upload to IPFS
    const result = await pinata.pinJSONToIPFS(metadata, {
      pinataMetadata: {
        name: `${validated.symbol}-metadata`,
      },
    });

    // 4. Return response
    return c.json({
      success: true,
      ipfsUri: `ipfs://${result.IpfsHash}`,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
      metadata,
    });

  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      }, 400);
    }

    // Handle Pinata API errors
    if (error instanceof Error && error.message.includes('Pinata')) {
      return c.json({
        success: false,
        error: {
          code: 'IPFS_UPLOAD_ERROR',
          message: 'Failed to upload metadata to IPFS',
          details: error.message,
        },
      }, 500);
    }

    // Generic error handling
    console.error('Metadata creation error:', error);
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    }, 500);
  }
}
