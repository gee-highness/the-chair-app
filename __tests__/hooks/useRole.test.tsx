// __tests__/hooks/useRole.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRole, RoleProvider } from '@/hooks/useRole';

describe('useRole', () => {
  it('throws a clear error when used outside a RoleProvider', () => {
    // Suppress the expected React error-boundary console noise for this
    // one intentionally-throwing render.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useRole())).toThrow(/RoleProvider/);
    spy.mockRestore();
  });

  it('returns the role value from the nearest RoleProvider', () => {
    const { result } = renderHook(() => useRole(), {
      wrapper: ({ children }) => <RoleProvider value="receptionist">{children}</RoleProvider>,
    });
    expect(result.current).toBe('receptionist');
  });
});
