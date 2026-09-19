// __tests__/upload-image.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { FakeDb } from './helpers/fakeMongo';
import { nextRequest } from './helpers/nextRequest';

const fakeDb = vi.hoisted(() => ({ db: null as any }));
const blobMock = vi.hoisted(() => ({ put: vi.fn() }));

vi.mock('@/lib/mongodb', () => ({
  getDatabase: async () => fakeDb.db,
  connectToDatabase: async () => ({ db: fakeDb.db, client: {} }),
}));

vi.mock('@vercel/blob', () => ({
  put: blobMock.put,
}));

function hash(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function adminToken(db: FakeDb) {
  const rawToken = crypto.randomBytes(16).toString('hex');
  db.collection('sessions').seed([
    ...db.collection('sessions').docs,
    { tokenHash: hash(rawToken), subjectId: new ObjectId(), subjectType: 'user', role: 'admin', tenantId: new ObjectId(), expiresAt: new Date(Date.now() + 60_000) },
  ]);
  return rawToken;
}

function fileOf(bytes: number, type: string, name = 'photo.jpg'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function uploadRequest(file: File | null, rawToken?: string) {
  const form = new FormData();
  if (file) form.set('file', file);
  return nextRequest('http://localhost/api/upload-image', {
    method: 'POST',
    headers: rawToken ? { cookie: `session=${rawToken}` } : {},
    body: form as any,
  });
}

describe('POST /api/upload-image', () => {
  beforeEach(() => {
    fakeDb.db = new FakeDb();
    blobMock.put.mockReset();
    blobMock.put.mockResolvedValue({ url: 'https://blob.example/photo-abc123.jpg', pathname: 'photo-abc123.jpg' });
  });

  it('requires an admin session', async () => {
    const { POST } = await import('@/app/api/upload-image/route');
    const res = await POST(uploadRequest(fileOf(100, 'image/jpeg')));
    expect(res.status).toBe(401);
    expect(blobMock.put).not.toHaveBeenCalled();
  });

  it('rejects a request with no file', async () => {
    const { POST } = await import('@/app/api/upload-image/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = adminToken(db);
    const res = await POST(uploadRequest(null, rawToken));
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported file type', async () => {
    const { POST } = await import('@/app/api/upload-image/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = adminToken(db);
    const res = await POST(uploadRequest(fileOf(100, 'application/pdf', 'doc.pdf'), rawToken));
    expect(res.status).toBe(400);
    expect(blobMock.put).not.toHaveBeenCalled();
  });

  it('rejects a file over 5MB', async () => {
    const { POST } = await import('@/app/api/upload-image/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = adminToken(db);
    const res = await POST(uploadRequest(fileOf(6 * 1024 * 1024, 'image/jpeg'), rawToken));
    expect(res.status).toBe(400);
    expect(blobMock.put).not.toHaveBeenCalled();
  });

  it('uploads a valid image and returns its blob url/pathname', async () => {
    const { POST } = await import('@/app/api/upload-image/route');
    const db = fakeDb.db as FakeDb;
    const rawToken = adminToken(db);
    const res = await POST(uploadRequest(fileOf(1024, 'image/png', 'logo.png'), rawToken));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toBe('https://blob.example/photo-abc123.jpg');
    expect(blobMock.put).toHaveBeenCalledWith('logo.png', expect.anything(), { access: 'public', addRandomSuffix: true });
  });
});
