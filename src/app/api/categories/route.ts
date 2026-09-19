// src/app/api/categories/route.ts
//
// Staff-facing CRUD for a tenant's service categories. Tenant scoping comes
// from the authenticated session — see src/lib/requireRole.ts.
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { requireRole } from '@/lib/requireRole';
import { Category } from '@/lib/types';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const ALLOWED_UPDATE_FIELDS = ['name', 'imageUrl'];

export async function GET(req: NextRequest) {
  const session = await requireRole(req, ['admin', 'receptionist', 'barber']);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDatabase();
    const categories = await db
      .collection<Category>('categories')
      .find({ tenantId: session.tenantId })
      .toArray();

    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch categories', error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, imageUrl } = body;

    if (!name) return NextResponse.json({ message: 'Missing name' }, { status: 400 });

    const db = await getDatabase();
    const category: Category = {
      tenantId: session.tenantId,
      name,
      imageUrl,
    };

    const result = await db.collection<Category>('categories').insertOne(category);
    return NextResponse.json({ _id: result.insertedId, ...category }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to create category', error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'Missing category ID' }, { status: 400 });

    const db = await getDatabase();
    const categoryId = new ObjectId(id);

    // Don't delete a category still in use — leave services correctly
    // categorized rather than silently orphaning categoryId references.
    const inUse = await db.collection('services').countDocuments({ tenantId: session.tenantId, categoryId });
    if (inUse > 0) {
      return NextResponse.json({ message: `${inUse} service(s) still use this category` }, { status: 409 });
    }

    const result = await db.collection<Category>('categories').deleteOne({ _id: categoryId, tenantId: session.tenantId });
    if (result.deletedCount === 0) return NextResponse.json({ message: 'Category not found' }, { status: 404 });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to delete category', error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { _id, ...rest } = body;

    if (!_id) return NextResponse.json({ message: 'Missing category ID' }, { status: 400 });

    const updates: Record<string, any> = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in rest) updates[key] = rest[key];
    }

    const db = await getDatabase();
    const result = await db.collection<Category>('categories').findOneAndUpdate(
      { _id: new ObjectId(_id), tenantId: session.tenantId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) return NextResponse.json({ message: 'Category not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to update category', error: error.message }, { status: 500 });
  }
}
