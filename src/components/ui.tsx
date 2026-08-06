'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

// Avatar lives in ./Avatar so it can render on the server — it needs nothing from
// the browser, and living in this module made every one of them a hydration root.
// Import it from '@/components/Avatar'; re-exporting it here would pull it straight
// back into the client graph, since everything a 'use client' module touches joins it.

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
