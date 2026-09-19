// __tests__/helpers/fakeMongo.test.ts
//
// The route tests throughout this suite trust fakeMongo.ts to behave like
// real MongoDB for the operators/stages the app actually uses. If this
// harness is wrong, every test built on it could pass for the wrong
// reason. These tests exercise the harness directly, in isolation.
//
// Run with: npx vitest run __tests__/helpers/fakeMongo.test.ts
import { describe, it, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import { FakeDb } from './fakeMongo';

describe('FakeCollection — basic CRUD', () => {
  it('insertOne assigns an _id when none is given, and find/findOne see it', async () => {
    const db = new FakeDb();
    const result = await db.collection('widgets').insertOne({ name: 'Sprocket' });
    expect(result.insertedId).toBeInstanceOf(ObjectId);

    const found = await db.collection('widgets').findOne({ _id: result.insertedId });
    expect(found?.name).toBe('Sprocket');
  });

  it('find with a projection applies inclusion vs exclusion correctly', async () => {
    const db = new FakeDb();
    db.collection('widgets').seed([{ _id: new ObjectId(), name: 'A', secret: 'x' }]);

    const included = await db.collection('widgets').find({}, { projection: { name: 1 } }).toArray();
    expect(included[0]).toEqual({ name: 'A' });

    const excluded = await db.collection('widgets').find({}, { projection: { secret: 0 } }).toArray();
    expect(excluded[0].secret).toBeUndefined();
    expect(excluded[0].name).toBe('A');
  });

  it('$gte/$lte/$in/$nin query operators filter correctly', async () => {
    const db = new FakeDb();
    db.collection('nums').seed([{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }]);

    const range = await db.collection('nums').find({ v: { $gte: 2, $lte: 3 } }).toArray();
    expect(range.map((d: any) => d.v).sort()).toEqual([2, 3]);

    const inList = await db.collection('nums').find({ v: { $in: [1, 4] } }).toArray();
    expect(inList.map((d: any) => d.v).sort()).toEqual([1, 4]);

    const ninList = await db.collection('nums').find({ v: { $nin: [1, 4] } }).toArray();
    expect(ninList.map((d: any) => d.v).sort()).toEqual([2, 3]);
  });

  it('an unrecognized query operator throws instead of silently matching everything', async () => {
    const db = new FakeDb();
    db.collection('nums').seed([{ v: 1 }]);
    await expect(db.collection('nums').find({ v: { $mod: [2, 0] } }).toArray()).rejects.toThrow(/unsupported query operator/);
  });

  it('deleteOne removes exactly the matched document', async () => {
    const db = new FakeDb();
    const idA = new ObjectId();
    const idB = new ObjectId();
    db.collection('widgets').seed([{ _id: idA, name: 'A' }, { _id: idB, name: 'B' }]);

    const result = await db.collection('widgets').deleteOne({ _id: idA });
    expect(result.deletedCount).toBe(1);
    expect(await db.collection('widgets').countDocuments({})).toBe(1);
    expect(await db.collection('widgets').findOne({ _id: idB })).toBeTruthy();
  });

  it('find().sort().limit().toArray() chains like the real driver cursor (the public/tenants/[slug] reviews pattern)', async () => {
    const db = new FakeDb();
    db.collection('reviews').seed([
      { _id: new ObjectId(), rating: 3, createdAt: new Date('2026-01-01') },
      { _id: new ObjectId(), rating: 5, createdAt: new Date('2026-03-01') },
      { _id: new ObjectId(), rating: 4, createdAt: new Date('2026-02-01') },
    ]);

    const rows = await db.collection('reviews').find({}).sort({ createdAt: -1 }).limit(2).toArray();
    expect(rows.map((r: any) => r.rating)).toEqual([5, 4]);
  });
});

describe('FakeCollection — $set with dot-paths', () => {
  it('a dot-path $set key nests correctly instead of setting a literal "a.b" key', async () => {
    const db = new FakeDb();
    const id = new ObjectId();
    db.collection('tenants').seed([{ _id: id, branding: { primaryColor: '#000', secondaryColor: '#111' } }]);

    await db.collection('tenants').updateOne({ _id: id }, { $set: { 'branding.primaryColor': '#fff' } });

    const updated = await db.collection('tenants').findOne({ _id: id });
    expect(updated?.branding.primaryColor).toBe('#fff');
    expect(updated?.branding.secondaryColor).toBe('#111'); // sibling untouched
    expect((updated as any)['branding.primaryColor']).toBeUndefined(); // not a literal key
  });
});

describe('FakeCollection — upsert', () => {
  it('updateOne with upsert:true inserts a new doc from the filter + $setOnInsert + $set when nothing matches', async () => {
    const db = new FakeDb();
    const customerId = new ObjectId();
    const tenantId = new ObjectId();

    const result = await db.collection('favorites').updateOne(
      { customerId, tenantId },
      { $setOnInsert: { customerId, tenantId, createdAt: new Date('2026-01-01') } },
      { upsert: true }
    );
    expect(result.upsertedId).toBeInstanceOf(ObjectId);

    const all = await db.collection('favorites').find({}).toArray();
    expect(all).toHaveLength(1);
    expect(all[0].customerId.toString()).toBe(customerId.toString());
  });

  it('updateOne with upsert:true does NOT insert a duplicate when a doc already matches', async () => {
    const db = new FakeDb();
    const customerId = new ObjectId();
    const tenantId = new ObjectId();
    db.collection('favorites').seed([{ _id: new ObjectId(), customerId, tenantId, createdAt: new Date() }]);

    await db.collection('favorites').updateOne(
      { customerId, tenantId },
      { $setOnInsert: { customerId, tenantId, createdAt: new Date() } },
      { upsert: true }
    );

    expect(await db.collection('favorites').countDocuments({})).toBe(1);
  });

  it('findOneAndUpdate with upsert:true returns the newly-created doc (returnDocument: after)', async () => {
    const db = new FakeDb();
    const tenantId = new ObjectId();

    const result = await db.collection('siteSettings').findOneAndUpdate(
      { tenantId },
      { $set: { title: 'New Salon' }, $setOnInsert: { tenantId } },
      { returnDocument: 'after', upsert: true }
    );

    expect(result?.title).toBe('New Salon');
    expect(result?.tenantId.toString()).toBe(tenantId.toString());
    expect(await db.collection('siteSettings').countDocuments({})).toBe(1);
  });
});

describe('FakeCollection — aggregate()', () => {
  it('$match filters before later stages run', async () => {
    const db = new FakeDb();
    const tenantA = new ObjectId();
    const tenantB = new ObjectId();
    db.collection('appointments').seed([
      { _id: new ObjectId(), tenantId: tenantA, status: 'pending' },
      { _id: new ObjectId(), tenantId: tenantB, status: 'pending' },
    ]);

    const rows = await db.collection('appointments').aggregate([{ $match: { tenantId: tenantA } }]).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].tenantId.toString()).toBe(tenantA.toString());
  });

  it('$lookup joins in matching foreign docs as an array on the given field', async () => {
    const db = new FakeDb();
    const barberId = new ObjectId();
    db.collection('appointments').seed([{ _id: new ObjectId(), barberId }]);
    db.collection('barbers').seed([{ _id: barberId, name: 'Alex' }]);

    const rows = await db
      .collection('appointments')
      .aggregate([{ $lookup: { from: 'barbers', localField: 'barberId', foreignField: '_id', as: 'barber' } }])
      .toArray();

    expect(rows[0].barber).toHaveLength(1);
    expect(rows[0].barber[0].name).toBe('Alex');
  });

  it('$lookup produces an empty array (not an error) when nothing matches', async () => {
    const db = new FakeDb();
    db.collection('appointments').seed([{ _id: new ObjectId(), barberId: new ObjectId() }]);
    db.collection('barbers').seed([]);

    const rows = await db
      .collection('appointments')
      .aggregate([{ $lookup: { from: 'barbers', localField: 'barberId', foreignField: '_id', as: 'barber' } }])
      .toArray();

    expect(rows[0].barber).toEqual([]);
  });

  it('$addFields + $arrayElemAt pulls a single joined field out of a $lookup array (the appointments/reviews/my-appointments pattern)', async () => {
    const db = new FakeDb();
    const barberId = new ObjectId();
    db.collection('appointments').seed([{ _id: new ObjectId(), barberId }]);
    db.collection('barbers').seed([{ _id: barberId, name: 'Alex' }]);

    const rows = await db
      .collection('appointments')
      .aggregate([
        { $lookup: { from: 'barbers', localField: 'barberId', foreignField: '_id', as: 'barber' } },
        { $addFields: { barberName: { $arrayElemAt: ['$barber.name', 0] } } },
        { $project: { barber: 0 } },
      ])
      .toArray();

    expect(rows[0].barberName).toBe('Alex');
    expect(rows[0].barber).toBeUndefined();
  });

  it('$unwind on a $lookup array (the favorites/tenants pattern) collapses to a scalar object and drops non-matches', async () => {
    const db = new FakeDb();
    const tenantId = new ObjectId();
    const orphanFavoriteId = new ObjectId();
    db.collection('favorites').seed([
      { _id: new ObjectId(), tenantId },
      { _id: orphanFavoriteId, tenantId: new ObjectId() }, // no matching tenant below
    ]);
    db.collection('tenants').seed([{ _id: tenantId, name: 'Fade Factory', slug: 'fade-factory' }]);

    const rows = await db
      .collection('favorites')
      .aggregate([
        { $lookup: { from: 'tenants', localField: 'tenantId', foreignField: '_id', as: 'tenant' } },
        { $unwind: '$tenant' },
        { $project: { name: '$tenant.name', slug: '$tenant.slug' } },
      ])
      .toArray();

    expect(rows).toHaveLength(1); // the orphan (no matching tenant) is dropped, matching real $unwind
    expect(rows[0].name).toBe('Fade Factory');
    expect(rows[0].slug).toBe('fade-factory');
  });

  it('$sort orders ascending/descending and $project exclusion keeps the rest of the doc', async () => {
    const db = new FakeDb();
    db.collection('appointments').seed([
      { _id: new ObjectId(), dateTime: new Date('2026-03-01'), status: 'confirmed' },
      { _id: new ObjectId(), dateTime: new Date('2026-01-01'), status: 'pending' },
      { _id: new ObjectId(), dateTime: new Date('2026-02-01'), status: 'completed' },
    ]);

    const asc = await db.collection('appointments').aggregate([{ $sort: { dateTime: 1 } }]).toArray();
    expect(asc.map((r: any) => r.status)).toEqual(['pending', 'completed', 'confirmed']);

    const desc = await db.collection('appointments').aggregate([{ $sort: { dateTime: -1 } }]).toArray();
    expect(desc.map((r: any) => r.status)).toEqual(['confirmed', 'completed', 'pending']);
  });

  it('$dateToString formats using %Y-%m-%d (the analytics day-bucketing pattern)', async () => {
    const db = new FakeDb();
    db.collection('appointments').seed([{ _id: new ObjectId(), dateTime: new Date(2026, 2, 5) }]); // March 5 2026, local

    const rows = await db
      .collection('appointments')
      .aggregate([{ $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: '$dateTime' } } } }])
      .toArray();

    expect(rows[0].day).toBe('2026-03-05');
  });

  it('an unsupported aggregation stage throws instead of silently passing through', async () => {
    const db = new FakeDb();
    db.collection('appointments').seed([{ _id: new ObjectId() }]);
    await expect(db.collection('appointments').aggregate([{ $group: { _id: '$tenantId' } }] as any).toArray()).rejects.toThrow(
      /unsupported aggregation stage/
    );
  });

  it('an unsupported expression operator throws instead of silently passing through', async () => {
    const db = new FakeDb();
    db.collection('appointments').seed([{ _id: new ObjectId(), a: 1, b: 2 }]);
    await expect(
      db.collection('appointments').aggregate([{ $addFields: { sum: { $add: ['$a', '$b'] } } }] as any).toArray()
    ).rejects.toThrow(/unsupported aggregation expression/);
  });
});
