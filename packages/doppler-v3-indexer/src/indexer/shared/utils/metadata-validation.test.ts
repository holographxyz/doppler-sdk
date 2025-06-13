import { describe, it, expect } from 'vitest';
import { validateTokenMetadata, extractSocials } from './metadata-validation';

describe('Token Metadata Validation', () => {
  describe('extractSocials', () => {
    it('should extract social fields from various formats', () => {
      const metadata = {
        twitter: '@mytoken',
        telegram: 'https://t.me/mytoken',
        website: 'https://mytoken.com',
        discord: 'https://discord.gg/mytoken',
      };

      const result = extractSocials(metadata);

      expect(result).toEqual({
        twitter: 'mytoken', // @ removed
        telegram: 'https://t.me/mytoken',
        website: 'https://mytoken.com',
        discord: 'https://discord.gg/mytoken',
      });
    });

    it('should handle nested socials object', () => {
      const metadata = {
        socials: {
          twitter: 'mytoken_official',
          website: 'https://mytoken.io',
        },
      };

      const result = extractSocials(metadata);

      expect(result).toEqual({
        twitter: 'mytoken_official',
        website: 'https://mytoken.io',
      });
    });

    it('should handle alternative field names', () => {
      const metadata = {
        x: '@mytoken_x',
        url: 'https://mytoken.org',
        tg: 'mytokengroup',
      };

      const result = extractSocials(metadata);

      expect(result).toEqual({
        twitter: 'mytoken_x',
        website: 'https://mytoken.org',
        telegram: 'mytokengroup',
      });
    });
  });

  describe('validateTokenMetadata', () => {
    it('should validate correct metadata', () => {
      const metadata = {
        name: 'My Token',
        symbol: 'MTK',
        description: 'A test token',
        image: 'ipfs://QmXXX',
        twitter: '@mytoken',
      };

      const result = validateTokenMetadata(metadata);

      expect(result.isValid).toBe(true);
      expect(result.validated).toBeTruthy();
      expect(result.validated?.socials?.twitter).toBe('mytoken');
    });

    it('should handle invalid metadata gracefully', () => {
      const metadata = {
        name: 'A', // Too short
        symbol: 'invalid-symbol', // Contains invalid chars
        image: 'ipfs://QmXXX',
      };

      const result = validateTokenMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.validated).toBeNull();
      expect(result.errors).toBeTruthy();
      expect(result.structured).toBeTruthy(); // Still returns structured data
    });

    it('should use fallback values', () => {
      const metadata = {
        description: 'Token without name/symbol',
        image: 'ipfs://QmXXX',
      };

      const result = validateTokenMetadata(metadata, {
        name: 'Unknown Token',
        symbol: 'UNK',
      });

      expect(result.isValid).toBe(true);
      expect(result.validated?.name).toBe('Unknown Token');
      expect(result.validated?.symbol).toBe('UNK');
    });
  });
});
