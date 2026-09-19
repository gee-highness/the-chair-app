// src/app/api/public/tenants/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = await getDatabase();

    // Fetch tenant
    const tenant = await db
      .collection('tenants')
      .findOne({ slug, status: 'active' }, { projection: { _id: 1, name: 1, slug: 1, branding: 1, contactEmail: 1 } });

    if (!tenant) {
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 });
    }

    // Fetch site settings
    const settings = await db
      .collection('siteSettings')
      .findOne({ tenantId: tenant._id }, { projection: { passwordHash: 0 } });

    // Fetch barbers
    const barbers = await db
      .collection('barbers')
      .find({ tenantId: tenant._id }, { projection: { tenantId: 0 } })
      .toArray();

    // Fetch services
    const services = await db
      .collection('services')
      .find({ tenantId: tenant._id }, { projection: { tenantId: 0, passwordHash: 0 } })
      .toArray();

    // Fetch categories
    const categories = await db
      .collection('categories')
      .find({ tenantId: tenant._id }, { projection: { tenantId: 0 } })
      .toArray();

    // Fetch visible reviews (new in Part 2) — only ever those tied to a
    // real completed appointment (see POST /api/reviews), so this is
    // customer feedback that actually happened, not free-floating ratings.
    const reviews = await db
      .collection('reviews')
      .find({ tenantId: tenant._id, status: 'visible' }, { projection: { customerId: 0 } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

    return NextResponse.json({
      tenant,
      settings,
      barbers,
      services,
      categories,
      reviews,
      averageRating,
    });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch tenant details', error: error.message }, { status: 500 });
  }
}
