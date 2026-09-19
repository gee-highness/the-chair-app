// src/components/ui/MultiImageUpload.tsx
'use client';
import { useRef, useState } from 'react';
import { useToast } from './Toast';
import { Button } from './Button';
import styles from './MultiImageUpload.module.css';

export function MultiImageUpload({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        onChange([...values, data.url]);
      } else {
        toast.show(data.message || 'Upload failed', 'error');
      }
    } catch {
      toast.show('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{label}</span>
      <div className={styles.grid}>
        {values.map((url, i) => (
          <div key={i} className={styles.item}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className={styles.image} />
            <button
              type="button"
              className={styles.remove}
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              aria-label="Remove photo"
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className={styles.addTile} onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? '…' : '+ Add'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="visually-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
