'use client';

import { useActionState, useRef, useState } from 'react';
import { updateProfileAction, type FormState } from '@/app/actions';
import { Avatar, SubmitButton, Toast } from './ui';

/** Square edge of the stored image. Enough for a 96px avatar on a retina screen. */
const SIZE = 256;
const QUALITY = 0.82;

/**
 * Shrinks whatever was picked to a small centre-cropped square before it ever
 * leaves the browser. Pictures are stored in the database as data URLs, so a
 * 4 MB phone photo has to become a few kilobytes first.
 */
function toSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('That file is not an image.'));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process that image.'));
        const edge = Math.min(image.width, image.height);
        ctx.drawImage(
          image,
          (image.width - edge) / 2,
          (image.height - edge) / 2,
          edge,
          edge,
          0,
          0,
          SIZE,
          SIZE,
        );
        resolve(canvas.toDataURL('image/jpeg', QUALITY));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileForm({
  name,
  handle,
  avatar,
}: {
  name: string;
  handle: string;
  avatar: string | null;
}) {
  const [state, formAction] = useActionState(updateProfileAction, {} as FormState);
  const [preview, setPreview] = useState<string | null>(avatar);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);
    try {
      setPreview(await toSquareDataUrl(file));
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not use that image.');
    }
  };

  return (
    <form action={formAction} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input type="hidden" name="avatar" value={preview ?? ''} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar name={name} src={preview} size={72} radius={20} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()}>
              {preview ? 'Change picture' : 'Upload picture'}
            </button>
            {preview && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>
                Remove
              </button>
            )}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.55 }}>
            Cropped to a square and shrunk in your browser — nothing large is uploaded.
          </div>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => pick(e.target.files?.[0])}
      />

      <div className="field">
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" name="name" defaultValue={name} maxLength={60} required />
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)' }}>
          Your handle stays @{handle}.
        </div>
      </div>

      {(state.error || localError) && <div className="error">{state.error || localError}</div>}

      <SubmitButton className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} pendingLabel="Saving…">
        Save profile
      </SubmitButton>
      <Toast message={state.ok} />
    </form>
  );
}
