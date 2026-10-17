// src/app/page.tsx
//
// Discovery surface. Rebuilt for Part 2 Phase F: service results now link
// to their salon (previously showed a price with no way to act on it —
// audit finding), and "Near me" adds geolocation-based distance sort via
// the search route's lat/lng params.
'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonLines } from '@/components/ui/Skeleton';
import { CustomerSignInModal } from '@/components/CustomerSignInModal';
import { SocialFeed } from '@/components/SocialFeed';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useStaffSession, dashboardHref } from '@/hooks/useStaffSession';
import { useInstalledApps } from '@/hooks/useInstalledApps';
import { appPath, installedKey } from '@/lib/installedApps';
import { formatPrice } from '@/lib/currency';
import styles from './page.module.css';

const DiscoveryMap = dynamic(() => import('@/components/DiscoveryMap'), { ssr: false });

interface TenantResult {
  _id: string;
  name: string;
  slug: string;
  currency?: string;
  logoUrl?: string | null;
  tagline?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  minPrice?: number | null;
  branding?: { primaryColor: string };
  distanceKm?: number | null;
  lat?: number | null;
  lng?: number | null;
  barbers?: { _id: string; name: string; slug: string; imageUrl?: string }[];
}

interface BarberResult {
  _id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  tags: string[];
  tenantName: string;
  tenantSlug: string;
  distanceKm?: number | null;
  averageRating?: number | null;
  reviewCount: number;
  followerCount: number;
}

type SortKey = 'best' | 'nearest' | 'rating';

const QUICK_PICKS = ['Haircut', 'Fade', 'Beard', 'Braids', 'Kids', 'Shave'];

function Stars({ rating, count }: { rating?: number | null; count?: number }) {
  if (!rating || !count) return <span className={styles.newBadge}>New</span>;
  return (
    <span className={styles.rating} aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${count} reviews`}>
      <span aria-hidden="true">★</span> {rating.toFixed(1)} <span className={styles.ratingCount}>({count})</span>
    </span>
  );
}

function Avatar({ src, name, size = 44, tint }: { src?: string | null; name: string; size?: number; tint?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={styles.avatar} style={{ width: size, height: size }} />
  ) : (
    <span className={styles.avatarFallback} style={{ width: size, height: size, background: tint || undefined }} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

interface ServiceResult {
  _id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantCurrency?: string;
  name: string;
  price: number;
  duration: number;
  imageUrl?: string;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [tenants, setTenants] = useState<TenantResult[]>([]);
  const [services, setServices] = useState<ServiceResult[]>([]);
  const [barbers, setBarbers] = useState<BarberResult[]>([]);
  const [sort, setSort] = useState<SortKey>('best');
  const [topRatedOnly, setTopRatedOnly] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [error, setError] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'discover' | 'feed'>('discover');
  const [resultsView, setResultsView] = useState<'stylised' | 'map' | 'split'>('stylised');
  const { customer, signInOpen, setSignInOpen, requireSignIn, onSignedIn, signOut } = useCustomerAuth();
  const { staff, clearStaff } = useStaffSession();
  const { apps: installedApps, forget: forgetInstalled } = useInstalledApps();
  const installedKeys = new Set(installedApps.map(installedKey));
  const staffDashboard = dashboardHref(staff);

  useEffect(() => {
    if (!customer) {
      setFavoriteIds(new Set());
      return;
    }
    fetch('/api/favorites')
      .then((r) => (r.ok ? r.json() : []))
      .then((favs) => setFavoriteIds(new Set(favs.map((f: any) => f.tenantId))));
  }, [customer]);

  // The backend already returns a full listing for an empty query — run it
  // on mount so visitors see something before they've typed anything.
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFavorite = (tenantId: string) => {
    requireSignIn(async () => {
      const isFav = favoriteIds.has(tenantId);
      if (isFav) {
        await fetch(`/api/favorites?tenantId=${tenantId}`, { method: 'DELETE' });
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(tenantId);
          return next;
        });
      } else {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId }),
        });
        setFavoriteIds((prev) => new Set(prev).add(tenantId));
      }
    });
  };

  const runSearch = async (overrideCoords?: { lat: number; lng: number } | null, overrideQuery?: string) => {
    setLoading(true);
    setSearched(true);
    setError(false);
    try {
      const useCoords = overrideCoords !== undefined ? overrideCoords : coords;
      const q = overrideQuery !== undefined ? overrideQuery : query;
      setLastQuery(q.trim());
      const params = new URLSearchParams({ q });
      if (useCoords) {
        params.set('lat', String(useCoords.lat));
        params.set('lng', String(useCoords.lng));
      }
      const res = await fetch(`/api/public/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
        setServices(data.services || []);
        setBarbers(data.barbers || []);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  const useNearMe = () => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next);
        setLocating(false);
        runSearch(next);
      },
      () => {
        setLocating(false);
        setGeoDenied(true);
      }
    );
  };

  const pickQuick = (term: string) => {
    setQuery(term);
    runSearch(undefined, term);
  };

  const clearSearch = () => {
    setQuery('');
    setCoords(null);
    setSort('best');
    setTopRatedOnly(false);
    runSearch(null, '');
  };

  const visibleTenants = tenants
    .filter((t) => !topRatedOnly || (t.averageRating != null && t.averageRating >= 4))
    .slice()
    .sort((a, b) => {
      if (sort === 'rating') return (b.averageRating ?? 0) - (a.averageRating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      if (sort === 'nearest') return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      return 0;
    });
  const hasFilters = Boolean(lastQuery) || coords !== null || topRatedOnly || sort !== 'best';

  return (
    <>
      <header className={styles.siteHeader}>
        <div className={styles.siteHeaderInner}>
          <Link href="/" className={styles.siteBrand}>
            <Logo size={32} />
          </Link>
          {customer === undefined || staff === undefined ? null : customer || staffDashboard ? (
            <div className={styles.accountArea}>
              {customer && <span className={styles.accountName}>Hi, {customer.name.split(' ')[0]}</span>}
              {staffDashboard && (
                <Link href={staffDashboard} className={styles.accountButton}>
                  Dashboard
                </Link>
              )}
              {customer && (
                <Link href="/account" className={styles.accountButton}>
                  Account
                </Link>
              )}
              <button
                className={styles.accountButton}
                onClick={async () => {
                  await signOut();
                  clearStaff();
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button className={styles.accountButtonPrimary} onClick={() => setSignInOpen(true)}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Salons &amp; barbershops</p>
        <h1 className={styles.title}>Find your chair.</h1>
        <p className={styles.subtitle}>
          Discover top barbers near you, see their work and book in a minute. Follow a barber and install their app.
        </p>

        <form onSubmit={handleSearch} className={styles.searchForm} role="search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search salons, barbers or services…"
            className={styles.searchInput}
            aria-label="Search"
          />
          <Button type="submit" loading={loading}>
            Search
          </Button>
          <Button type="button" variant="secondary" loading={locating} onClick={useNearMe}>
            Near me
          </Button>
        </form>

        <div className={styles.chips} role="group" aria-label="Popular searches">
          {QUICK_PICKS.map((term) => (
            <button
              key={term}
              type="button"
              className={[styles.chip, lastQuery.toLowerCase() === term.toLowerCase() ? styles.chipActive : ''].join(' ')}
              aria-pressed={lastQuery.toLowerCase() === term.toLowerCase()}
              onClick={() => pickQuick(term)}
            >
              {term}
            </button>
          ))}
        </div>
        {geoDenied && !coords && (
          <p className={styles.nearMeNote} role="status">
            We couldn&apos;t get your location. Allow location access in your browser, or search by name.
          </p>
        )}
      </section>

      <div className={styles.viewSwitch} role="tablist" aria-label="Discovery sections">
        <Button role="tab" aria-selected={view === 'discover'} variant={view === 'discover' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('discover')}>
          Discover salons
        </Button>
        <Button role="tab" aria-selected={view === 'feed'} variant={view === 'feed' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('feed')}>
          Stylist feed
        </Button>
      </div>

      {view === 'feed' && <SocialFeed requireSignIn={requireSignIn} />}

      {view === 'discover' && (
      <>
      {installedApps.length > 0 && (
        <section className={styles.section} aria-labelledby="installed-heading">
          <h2 id="installed-heading" className={styles.sectionTitle}>Your apps</h2>
          <ul className={styles.barberRail}>
            {installedApps.map((a) => (
              <li key={installedKey(a)} className={styles.installedItem}>
                <Link href={appPath(a)} className={styles.barberCard} style={a.color ? { borderTop: `4px solid ${a.color}` } : undefined}>
                  <Avatar src={a.imageUrl} name={a.name} size={56} tint={a.color} />
                  <strong className={styles.barberName}>{a.name}</strong>
                  <span className={styles.installedBadge}>Installed {a.kind === 'barber' ? '· Barber' : '· Salon'}</span>
                </Link>
                <button
                  type="button"
                  className={styles.forgetButton}
                  aria-label={`Remove ${a.name} from this list`}
                  title="Not installed any more? Remove from this list"
                  onClick={() => forgetInstalled(a)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.toolbar}>
        <p className={styles.resultSummary} role="status" aria-live="polite">
          {loading
            ? 'Searching…'
            : searched
              ? `${tenants.length} ${tenants.length === 1 ? 'salon' : 'salons'} · ${barbers.length} ${barbers.length === 1 ? 'barber' : 'barbers'}${lastQuery ? ` for “${lastQuery}”` : ''}${coords ? ', nearest first' : ''}`
              : ''}
        </p>
        <div className={styles.toolbarControls}>
          <label className={styles.sortLabel}>
            Sort
            <select className={styles.sortSelect} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="best">Best match</option>
              <option value="rating">Top rated</option>
              <option value="nearest" disabled={!coords}>
                Nearest{coords ? '' : ' (turn on Near me)'}
              </option>
            </select>
          </label>
          <button
            type="button"
            className={[styles.chip, topRatedOnly ? styles.chipActive : ''].join(' ')}
            aria-pressed={topRatedOnly}
            onClick={() => setTopRatedOnly((v) => !v)}
          >
            ★ 4+ only
          </button>
          {hasFilters && (
            <button type="button" className={styles.clearButton} onClick={clearSearch}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {coords && <p className={styles.nearMeNote}>Showing results sorted by distance from you.</p>}

      {tenants.length > 0 && (
        <div className={styles.resultsViewSwitch} role="group" aria-label="Results view">
          {([['stylised', 'List'], ['map', 'Map'], ['split', 'Both']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={[styles.resultsViewButton, resultsView === key ? styles.resultsViewButtonActive : ''].join(' ')}
              aria-pressed={resultsView === key}
              onClick={() => setResultsView(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className={styles.skeletonGrid} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <Skeleton width={44} height={44} radius="50%" />
              <div style={{ flex: 1 }}>
                <SkeletonLines count={2} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {error && (
            <EmptyState
              title="Couldn't load results"
              description="Check your connection and try again."
              action={<Button size="sm" onClick={() => runSearch()}>Try again</Button>}
            />
          )}

          {!error && searched && tenants.length === 0 && services.length === 0 && barbers.length === 0 && (
            <EmptyState
              title="No results"
              description="Try a different search term, or clear your filters."
              action={hasFilters ? <Button size="sm" variant="secondary" onClick={clearSearch}>Clear all</Button> : undefined}
            />
          )}

          {barbers.length > 0 && (
            <section className={styles.section} aria-labelledby="barbers-heading">
              <h2 id="barbers-heading" className={styles.sectionTitle}>
                {lastQuery ? 'Barbers' : 'Featured barbers'}
              </h2>
              <ul className={styles.barberRail}>
                {barbers.map((b) => (
                  <li key={b._id}>
                    <Link href={`/t/${b.tenantSlug}/barbers/${b.slug}`} className={styles.barberCard}>
                      <Avatar src={b.imageUrl} name={b.name} size={72} />
                      <strong className={styles.barberName}>{b.name}</strong>
                      {installedKeys.has(installedKey({ kind: 'barber', slug: b.tenantSlug, barberSlug: b.slug })) && <span className={styles.installedBadge}>Installed</span>}
                      <span className={styles.barberSalon}>{b.tenantName}</span>
                      <Stars rating={b.averageRating} count={b.reviewCount} />
                      {b.tags.length > 0 && <span className={styles.barberTags}>{b.tags.slice(0, 2).join(' · ')}</span>}
                      {b.distanceKm != null && <span className={styles.distance}>{b.distanceKm.toFixed(1)} km</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {visibleTenants.length > 0 && (
            <section className={styles.section} aria-labelledby="salons-heading">
              <h2 id="salons-heading" className={styles.sectionTitle}>Salons</h2>
              <div className={resultsView === 'split' ? styles.splitView : undefined}>
                {(resultsView === 'map' || resultsView === 'split') && (
                  visibleTenants.some((t) => t.lat != null && t.lng != null) ? (
                    <div className={styles.mapWrap}>
                      <DiscoveryMap
                        center={coords}
                        height={resultsView === 'split' ? 520 : 420}
                        pins={visibleTenants
                          .filter((t) => t.lat != null && t.lng != null)
                          .map((t) => ({ _id: t._id, name: t.name, slug: t.slug, lat: t.lat!, lng: t.lng!, barbers: t.barbers || [] }))}
                      />
                    </div>
                  ) : (
                    <EmptyState title="No mapped salons" description="None of these salons have a location on file yet. Try the list view instead." />
                  )
                )}

                {(resultsView === 'stylised' || resultsView === 'split') && (
                  <div className={styles.tenantGrid}>
                    {visibleTenants.map((t) => {
                      const tint = t.branding?.primaryColor || 'var(--brass)';
                      return (
                        <div key={t._id} className={styles.tenantCardWrap}>
                          <Link href={`/t/${t.slug}`} className={styles.tenantCard} style={{ borderLeftColor: tint }}>
                            <Avatar src={t.logoUrl} name={t.name} tint={tint} />
                            <span className={styles.tenantInfo}>
                              <strong>{t.name}</strong>
                              {installedKeys.has(installedKey({ kind: 'salon', slug: t.slug })) && <span className={styles.installedBadge}>Installed</span>}
                              {t.tagline && <span className={styles.tagline}>{t.tagline}</span>}
                              <span className={styles.tenantMeta}>
                                <Stars rating={t.averageRating} count={t.reviewCount} />
                                {t.minPrice != null && (
                                  <span className={styles.mono}>from {formatPrice(t.minPrice, t.currency)}</span>
                                )}
                                {t.distanceKm != null && <span className={styles.distance}>{t.distanceKm.toFixed(1)} km away</span>}
                              </span>
                              {t.barbers && t.barbers.length > 0 && (
                                <span className={styles.team}>
                                  {t.barbers.slice(0, 4).map((b) => (
                                    <Avatar key={b._id} src={b.imageUrl} name={b.name} size={24} />
                                  ))}
                                  <span className={styles.teamCount}>
                                    {t.barbers.length} {t.barbers.length === 1 ? 'barber' : 'barbers'}
                                  </span>
                                </span>
                              )}
                            </span>
                          </Link>
                          <button
                            className={styles.favoriteButton}
                            aria-pressed={favoriteIds.has(t._id)}
                            aria-label={favoriteIds.has(t._id) ? `Remove ${t.name} from favorites` : `Save ${t.name} as favorite`}
                            onClick={() => toggleFavorite(t._id)}
                          >
                            {favoriteIds.has(t._id) ? '♥' : '♡'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {!error && searched && tenants.length > 0 && visibleTenants.length === 0 && (
            <EmptyState
              title="No salons match these filters"
              action={<Button size="sm" variant="secondary" onClick={() => setTopRatedOnly(false)}>Show all salons</Button>}
            />
          )}

          {services.length > 0 && (
            <section className={styles.section} aria-labelledby="services-heading">
              <h2 id="services-heading" className={styles.sectionTitle}>Services</h2>
              <div className={styles.serviceGrid}>
                {services.map((s) => (
                  <Link key={s._id} href={`/t/${s.tenantSlug}`} className={styles.serviceCard}>
                    {s.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.imageUrl} alt="" className={styles.serviceImage} />
                    )}
                    <strong>{s.name}</strong>
                    <p className={styles.serviceMeta}>
                      <span className={styles.mono}>{formatPrice(s.price, s.tenantCurrency)}</span> · {s.duration} min
                    </p>
                    <p className={styles.serviceTenant}>at {s.tenantName}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      </>
      )}

      <CustomerSignInModal open={signInOpen} onClose={() => setSignInOpen(false)} onSignedIn={onSignedIn} />
      </main>
    </>
  );
}
