// src/app/t/[tenantSlug]/barbers/[barberSlug]/page.tsx
//
// New in Part 2 — didn't exist before. Reuses the public tenant-details
// endpoint (already returns all barbers) rather than adding a new route
// per barber; finds the matching slug client-side.
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { BackLink } from '@/components/BackLink';
import { SkeletonLines } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { CustomerSignInModal } from '@/components/CustomerSignInModal';
import { SocialFeed } from '@/components/SocialFeed';
import { FollowButton } from '@/components/FollowButton';
import { AppActions } from '@/components/AppActions';
import { useRecordInstall } from '@/hooks/useInstalledApps';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import styles from './page.module.css';

interface ReviewItem {
  _id: string;
  barberId?: string;
  rating: number;
  text?: string;
}

interface Barber {
  _id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  bio?: string;
  portfolio?: string[];
  tags?: string[];
  followerCount?: number;
  isFollowedByMe?: boolean;
  averageRating?: number;
  reviewCount?: number;
}

export default function BarberProfilePage() {
  const { tenantSlug, barberSlug } = useParams<{ tenantSlug: string; barberSlug: string }>();
  const [barber, setBarber] = useState<Barber | null | undefined>(undefined);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const { signInOpen, setSignInOpen, requireSignIn, onSignedIn } = useCustomerAuth();

  useRecordInstall(barber ? { kind: 'barber', slug: tenantSlug, barberSlug, name: barber.name, imageUrl: barber.imageUrl } : null);

  useEffect(() => {
    fetch(`/api/public/tenants/${tenantSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const found = data?.barbers?.find((b: Barber) => b.slug === barberSlug);
        setBarber(found || null);
        if (found) setReviews((data.reviews || []).filter((r: ReviewItem) => r.barberId && String(r.barberId) === String(found._id)));
      });
  }, [tenantSlug, barberSlug]);

  if (barber === undefined) return <SkeletonLines count={6} />;
  if (barber === null) return <EmptyState title="Barber not found" />;

  return (
    <div className={styles.wrap}>
      <p style={{ padding: 'var(--space-4)', margin: 0 }}>
        <BackLink href={`/t/${tenantSlug}`} label="← Back to salon" className={styles.backLink} />
      </p>
      <div className={styles.header}>
        {barber.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={barber.imageUrl} alt="" className={styles.avatar} />
        ) : (
          <div className={styles.avatarPlaceholder}>{barber.name.charAt(0)}</div>
        )}
        <div>
          <h1 className={styles.name}>{barber.name}</h1>
          {barber.tags && barber.tags.length > 0 && <p className={styles.tags}>{barber.tags.join(' · ')}</p>}
          
        </div>
      </div>

      <ul className={styles.stats} aria-label="At a glance">
        <li>
          <span className={styles.statValue}>
            {reviews.length > 0 ? `★ ${(reviews.reduce((n, r) => n + r.rating, 0) / reviews.length).toFixed(1)}` : barber.averageRating ? `★ ${barber.averageRating.toFixed(1)}` : 'New'}
          </span>
          <span className={styles.statLabel}>{reviews.length || barber.reviewCount || 0} reviews</span>
        </li>
        <li>
          <span className={styles.statValue}>{(barber.followerCount || 0).toLocaleString()}</span>
          <span className={styles.statLabel}>followers</span>
        </li>
        <li>
          <span className={styles.statValue}>{barber.portfolio?.length || 0}</span>
          <span className={styles.statLabel}>photos</span>
        </li>
      </ul>

      {barber.bio && <p className={styles.bio}>{barber.bio}</p>}

      <div className={styles.actionRow}>
        <FollowButton
          barberId={barber._id}
          initialFollowed={barber.isFollowedByMe || false}
          initialFollowerCount={barber.followerCount || 0}
          requireSignIn={requireSignIn}
        />
      </div>

      <div className={styles.appActions}>
        <AppActions name={barber.name} path={`/t/${tenantSlug}/barbers/${barberSlug}`} />
      </div>

      {barber.portfolio && barber.portfolio.length > 0 && (
        <section className={styles.portfolioSection}>
          <h2 className={styles.portfolioTitle}>Portfolio</h2>
          <div className={styles.portfolioGrid}>
            {barber.portfolio.slice(0, 6).map((url, i) => (
              <button key={i} type="button" className={styles.portfolioButton} onClick={() => setPhoto(url)} aria-label={`View photo ${i + 1} of ${barber.name}'s work`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Work by ${barber.name}, photo ${i + 1}`}
                  className={styles.portfolioImage}
                  loading={i < 3 ? 'eager' : 'lazy'}
                />
              </button>
            ))}
          </div>
          {barber.portfolio.length > 6 && (
            <p className={styles.viewMore}>
              +{barber.portfolio.length - 6} more photos
            </p>
          )}
        </section>
      )}

      {reviews.length > 0 && (
        <section className={styles.portfolioSection}>
          <h2 className={styles.portfolioTitle}>Reviews</h2>
          <div className={styles.reviewList}>
            {reviews.slice(0, 6).map((r) => (
              <div key={r._id} className={styles.reviewCard}>
                <p className={styles.reviewStars} aria-label={`${r.rating} out of 5`}>
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)}
                </p>
                {r.text && <p className={styles.reviewText}>{r.text}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.portfolioSection}>
        <h2 className={styles.portfolioTitle}>Posts</h2>
        <SocialFeed barberId={barber._id} requireSignIn={requireSignIn} />
      </section>

      <div className={styles.stickyBook}>
        <Link href={`/t/${tenantSlug}/barbers/${barberSlug}/book`}>
          <Button fullWidth size="lg">Book with {barber.name.split(' ')[0]}</Button>
        </Link>
      </div>

      <Modal open={photo !== null} onClose={() => setPhoto(null)} title={`${barber.name}'s work`}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={`Work by ${barber.name}`} className={styles.lightboxImage} />
        )}
      </Modal>

      <CustomerSignInModal open={signInOpen} onClose={() => setSignInOpen(false)} onSignedIn={onSignedIn} />
    </div>
  );
}
