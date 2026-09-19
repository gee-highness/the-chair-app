// src/app/t/[tenantSlug]/dashboard/customers/page.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLines } from '@/components/ui/Skeleton';
import styles from './page.module.css';

interface Customer {
  _id: string;
  name: string;
  email: string;
  phone: string;
  loyaltyPoints: Record<string, number>;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/customers').then((r) => (r.ok ? r.json() : [])).then(setCustomers);
    fetch('/api/tenant/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTenantId(data?.tenant?._id || null));
  }, []);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, query]);

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Customers</h1>
        <input
          className={styles.search}
          placeholder="Search by name, email, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search customers"
        />
      </div>

      {customers === null ? (
        <SkeletonLines count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState title={query ? 'No matches' : 'No customers yet'} description={query ? 'Try a different search.' : 'Customers appear here once they book online or a walk-in is added.'} />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Loyalty points</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c._id}>
                <td className={styles.nameCell}>{c.name}</td>
                <td>{c.email}</td>
                <td className={styles.mono}>{c.phone}</td>
                <td className={styles.mono}>{tenantId ? c.loyaltyPoints?.[tenantId] ?? 0 : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
