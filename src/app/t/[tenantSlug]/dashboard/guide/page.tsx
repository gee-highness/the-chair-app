// The staff guide, inside the dashboard: only the guide written for the
// signed-in person's own role.
'use client';
import { GuideView } from '@/components/guide/GuideView';
import { guidesForStaffRole } from '@/lib/guide/guides';
import { useRole } from '@/hooks/useRole';

export default function DashboardGuidePage() {
  const role = useRole();
  return <GuideView guides={guidesForStaffRole(role)} />;
}
