import { describe, expect, it } from 'vitest';
import { PaginationHelper } from '../../src/utils/pagination';

describe('PaginationHelper', () => {
  describe('encodeCursor / decodeCursor', () => {
    it('should encode and decode cursor correctly', () => {
      const index = 20;
      const cursor = PaginationHelper.encodeCursor(index);
      expect(cursor).toBe('20');

      const decoded = PaginationHelper.decodeCursor(cursor);
      expect(decoded).toBe(20);
    });

    it('should return 0 for invalid cursor', () => {
      expect(PaginationHelper.decodeCursor('invalid-cursor')).toBe(0);
      expect(PaginationHelper.decodeCursor('')).toBe(0);
    });

    it('should return 0 for undefined cursor', () => {
      expect(PaginationHelper.decodeCursor(undefined)).toBe(0);
    });

    it('should return 0 for negative cursor', () => {
      expect(PaginationHelper.decodeCursor('-1')).toBe(0);
      expect(PaginationHelper.decodeCursor('-10')).toBe(0);
    });

    it('should handle zero cursor', () => {
      const cursor = PaginationHelper.encodeCursor(0);
      expect(cursor).toBe('0');
      expect(PaginationHelper.decodeCursor('0')).toBe(0);
    });
  });

  describe('paginate', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

    it('should return first page with no cursor', () => {
      const result = PaginationHelper.paginate(items);

      expect(result.items).toHaveLength(10);
      expect(result.items[0]).toEqual({ id: 1, name: 'Item 1' });
      expect(result.items[9]).toEqual({ id: 10, name: 'Item 10' });
      expect(result.nextCursor).toBe('10'); // Next cursor points to index 10
      expect(result._meta).toEqual({ total: 25, offset: 0, limit: 10 });
    });

    it('should return second page with cursor', () => {
      const result = PaginationHelper.paginate(items, '10');

      expect(result.items).toHaveLength(10);
      expect(result.items[0]).toEqual({ id: 11, name: 'Item 11' });
      expect(result.items[9]).toEqual({ id: 20, name: 'Item 20' });
      expect(result.nextCursor).toBe('20'); // Next cursor points to index 20
      expect(result._meta).toEqual({ total: 25, offset: 10, limit: 10 });
    });

    it('should return last page without nextCursor', () => {
      const result = PaginationHelper.paginate(items, '20');

      expect(result.items).toHaveLength(5);
      expect(result.items[0]).toEqual({ id: 21, name: 'Item 21' });
      expect(result.items[4]).toEqual({ id: 25, name: 'Item 25' });
      expect(result.nextCursor).toBeUndefined();
      expect(result._meta).toEqual({ total: 25, offset: 20, limit: 10 });
    });

    it('should handle custom page size', () => {
      const result = PaginationHelper.paginate(items, undefined, 5);

      expect(result.items).toHaveLength(5);
      expect(result.items[0]).toEqual({ id: 1, name: 'Item 1' });
      expect(result.items[4]).toEqual({ id: 5, name: 'Item 5' });
      expect(result.nextCursor).toBe('5');
      expect(result._meta).toEqual({ total: 25, offset: 0, limit: 5 });
    });

    it('should handle empty array', () => {
      const result = PaginationHelper.paginate([]);

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
      expect(result._meta).toEqual({ total: 0, offset: 0, limit: 10 });
    });

    it('should handle array smaller than page size', () => {
      const smallItems = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const result = PaginationHelper.paginate(smallItems);

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();
      expect(result._meta).toEqual({ total: 2, offset: 0, limit: 10 });
    });

    it('should handle exact page size multiples', () => {
      const exactItems = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
      }));

      // First page
      const page1 = PaginationHelper.paginate(exactItems);
      expect(page1.items).toHaveLength(10);
      expect(page1.nextCursor).toBe('10');

      // Second page (last page)
      const page2 = PaginationHelper.paginate(exactItems, page1.nextCursor);
      expect(page2.items).toHaveLength(10);
      expect(page2.nextCursor).toBeUndefined();
    });

    it('should handle invalid cursor by treating as first page', () => {
      const result = PaginationHelper.paginate(items, 'invalid-cursor');

      expect(result.items).toHaveLength(10);
      expect(result.items[0]).toEqual({ id: 1, name: 'Item 1' });
      expect(result._meta).toEqual({ total: 25, offset: 0, limit: 10 });
    });

    it('should support disabling metadata', () => {
      const result = PaginationHelper.paginate(items, undefined, 10, false);

      expect(result.items).toHaveLength(10);
      expect(result.nextCursor).toBe('10');
      expect(result._meta).toBeUndefined();
    });
  });

  describe('DEFAULT_PAGE_SIZE', () => {
    it('should have correct default page size', () => {
      expect(PaginationHelper.DEFAULT_PAGE_SIZE).toBe(10);
    });
  });
});
