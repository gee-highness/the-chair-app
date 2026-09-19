// src/app/t/[tenantSlug]/dashboard/barbers/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { MultiImageUpload } from '@/components/ui/MultiImageUpload';
import { TagInput } from '@/components/ui/TagInput';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLines } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useRole } from '@/hooks/useRole';
import { AvailabilityEditor, DailyAvailability } from '@/components/dashboard/AvailabilityEditor';
import styles from './page.module.css';

interface Barber {
  _id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  bio?: string;
  portfolio?: string[];
  tags?: string[];
  dailyAvailability: DailyAvailability[];
}

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const emptyForm = {
  name: '',
  slug: '',
  bio: '',
  imageUrl: '',
  portfolio: [] as string[],
  tags: [] as string[],
  dailyAvailability: [] as DailyAvailability[],
};

export default function BarbersPage() {
  const role = useRole();
  const allowed = role === 'admin';
  const toast = useToast();
  const [barbers, setBarbers] = useState<Barber[] | null>(null);
  const [modal, setModal] = useState<{ open: boolean; editing?: Barber }>({ open: false });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const load = () => fetch('/api/barbers').then((r) => (r.ok ? r.json() : [])).then(setBarbers);
  useEffect(() => {
    if (!allowed) return;
    load();
  }, [allowed]);

  if (!allowed) {
    return <EmptyState title="You don't have access to this page" description="Managing barbers is only available to admins." />;
  }

  const openNew = () => {
    setForm(emptyForm);
    setSlugTouched(false);
    setModal({ open: true });
  };
  const openEdit = (b: Barber) => {
    setForm({
      name: b.name,
      slug: b.slug,
      bio: b.bio || '',
      imageUrl: b.imageUrl || '',
      portfolio: b.portfolio || [],
      tags: b.tags || [],
      dailyAvailability: b.dailyAvailability || [],
    });
    setSlugTouched(true);
    setModal({ open: true, editing: b });
  };

  const save = async () => {
    setSaving(true);
    try {
      const editing = modal.editing;
      const res = await fetch('/api/barbers', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { _id: editing._id, ...form } : form),
      });
      if (res.ok) {
        toast.show(editing ? 'Barber updated' : 'Barber added', 'success');
        setModal({ open: false });
        load();
      } else {
        const data = await res.json();
        toast.show(data.message || 'Failed to save barber', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: Barber) => {
    if (!confirm(`Remove ${b.name} from your barbers?`)) return;
    const res = await fetch(`/api/barbers?id=${b._id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      toast.show('Barber removed', 'success');
      load();
    } else {
      toast.show(data.message || 'Could not remove barber', 'error');
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Barbers</h1>
        <Button size="sm" onClick={openNew}>
          Add barber
        </Button>
      </div>

      {barbers === null ? (
        <SkeletonLines count={3} />
      ) : barbers.length === 0 ? (
        <EmptyState
          title="No barbers yet"
          description="Add your team so customers can pick who they book with, and so you can set each person's hours."
          action={<Button size="sm" onClick={openNew}>Add your first barber</Button>}
        />
      ) : (
        <div className={styles.grid}>
          {barbers.map((b) => (
            <div key={b._id} className={styles.card}>
              {b.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.imageUrl} alt="" className={styles.avatar} />
              ) : (
                <div className={styles.avatarPlaceholder} aria-hidden="true">
                  {b.name.charAt(0)}
                </div>
              )}
              <div className={styles.cardBody}>
                <p className={styles.name}>{b.name}</p>
                {b.tags && b.tags.length > 0 && (
                  <p className={styles.tags}>{b.tags.join(' · ')}</p>
                )}
                {b.bio && <p className={styles.bio}>{b.bio}</p>}
                <p className={styles.availability}>
                  {(b.dailyAvailability || []).length} day{(b.dailyAvailability || []).length === 1 ? '' : 's'} scheduled
                </p>
                <div className={styles.rowActions}>
                  <button className={styles.textButton} onClick={() => openEdit(b)}>
                    Edit
                  </button>
                  <Button variant="danger" size="sm" onClick={() => remove(b)}>
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Edit barber' : 'Add barber'}>
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(e) => {
            const name = e.target.value;
            setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
          }}
        />
        <Input
          label="Profile URL slug"
          required
          hint="Used in the barber's profile link."
          value={form.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
          }}
        />
        <ImageUpload label="Photo" value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
        <Textarea label="Bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
        <TagInput label="Specialties" value={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
        <MultiImageUpload label="Portfolio" values={form.portfolio} onChange={(portfolio) => setForm((f) => ({ ...f, portfolio }))} />
        <AvailabilityEditor value={form.dailyAvailability} onChange={(dailyAvailability) => setForm((f) => ({ ...f, dailyAvailability }))} />
        <Button fullWidth loading={saving} onClick={save} disabled={!form.name || !form.slug}>
          Save barber
        </Button>
      </Modal>
    </div>
  );
}
