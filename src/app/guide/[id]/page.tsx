import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GUIDES, guideById } from '@/lib/guide/guides';
import { GuideView } from '@/components/guide/GuideView';
import { BackLink } from '@/components/BackLink';
import { SITE_NAME } from '@/lib/site';

export function generateStaticParams() {
  return GUIDES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const guide = guideById((await params).id);
  return guide ? { title: `${guide.title} · ${SITE_NAME}`, description: guide.tagline } : {};
}

export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const guide = guideById((await params).id);
  if (!guide) notFound();
  return (
    <>
      <div data-noprint style={{ maxWidth: 860, margin: '0 auto', padding: 'var(--space-4) var(--space-4) 0' }}>
        <BackLink href="/guide" label="← All guides" />
      </div>
      <GuideView guides={[guide]} />
    </>
  );
}
