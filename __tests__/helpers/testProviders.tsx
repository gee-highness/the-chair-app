// __tests__/helpers/testProviders.tsx
import { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { RoleProvider, StaffRole } from '@/hooks/useRole';
import { ToastProvider } from '@/components/ui/Toast';

/** Renders `ui` inside a RoleProvider — required by any dashboard page using useRole(). */
export function renderWithRole(ui: ReactElement, role: StaffRole = 'admin') {
  return render(<RoleProvider value={role}>{ui}</RoleProvider>);
}

/** Renders `ui` inside a ToastProvider — required by any component/page using useToast(). */
export function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

/** Both at once — the shape every real dashboard page renders inside (see DashboardShell.tsx). */
export function renderInDashboard(ui: ReactElement, role: StaffRole = 'admin') {
  return render(
    <ToastProvider>
      <RoleProvider value={role}>{ui}</RoleProvider>
    </ToastProvider>
  );
}
