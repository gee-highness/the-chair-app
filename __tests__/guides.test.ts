// __tests__/guides.test.ts
import { describe, it, expect } from 'vitest';
import { GUIDES, guideById, guidesForStaffRole } from '@/lib/guide/guides';

describe('user guides', () => {
  it('has a guide for every kind of user, each with sections and an FAQ', () => {
    expect(GUIDES.map((g) => g.id).sort()).toEqual(['barber', 'customer', 'owner', 'platform', 'receptionist']);
    for (const g of GUIDES) {
      expect(g.sections.length).toBeGreaterThan(2);
      expect(g.faq.length).toBeGreaterThan(0);
      for (const s of g.sections) expect(s.steps.length).toBeGreaterThan(0);
    }
  });

  it('section ids are unique within a guide (they are anchor targets)', () => {
    for (const g of GUIDES) {
      const ids = g.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('shows staff only the guide written for their role', () => {
    expect(guidesForStaffRole('admin').map((g) => g.id)).toEqual(['owner']);
    expect(guidesForStaffRole('receptionist').map((g) => g.id)).toEqual(['receptionist']);
    expect(guidesForStaffRole('barber').map((g) => g.id)).toEqual(['barber']);
  });

  it('looks guides up by id and returns undefined for unknown ones', () => {
    expect(guideById('customer')?.title).toBe('Customer Guide');
    expect(guideById('nope')).toBeUndefined();
  });
});
