'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { initials } from '@/lib/format';

export function Avatar({ name, size = 32, radius = 9 }: { name: string; size?: number; radius?: number }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.34) }}
    >
      {initials(name)}
    </div>
  );
}

export function SubmitButton({
  children,
  className = 'btn btn-primary',
  pendingLabel,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} {...rest}>
      {pending ? pendingLabel ?? children : children}
    </button>
  );
}

/** Fires once per distinct message, then fades itself out. */
export function Toast({ message }: { message?: string }) {
  const [shown, setShown] = useState<string | undefined>(message);

  useEffect(() => {
    setShown(message || undefined);
    if (!message) return;
    const t = setTimeout(() => setShown(undefined), 3200);
    return () => clearTimeout(t);
  }, [message]);

  if (!shown) return null;
  return <div className="toast">{shown}</div>;
}
