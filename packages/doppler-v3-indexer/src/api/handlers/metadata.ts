import PinataSDK from '@pinata/sdk';
import { z } from 'zod';
import type { Context } from 'hono';
import { tokenMetadataSchema } from '@app/indexer/shared/utils/metadata-validation';

// Initialize Pinata
const pinata = new PinataSDK(
  process.env.PINATA_API_KEY!,
  process.env.PINATA_API_SECRET!
);

export async function createTokenMetadata(c: Context) {
  try {
    // 1. Parse and validate request body
    const body = await c.req.json();
    const validated = tokenMetadataSchema.parse(body);

    // 2. Create metadata with creatorAddress and receiverAddress fields
    const metadata = {
      name: validated.name,
      symbol: validated.symbol,
      description: validated.description,
      image: validated.image,
      socials: validated.socials || {},
      creatorAddress: validated.creatorAddress,
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
