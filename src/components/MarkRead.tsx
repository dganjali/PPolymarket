'use client';

import { useEffect, useRef } from 'react';
import { markNotificationsReadAction } from '@/app/actions';

/**
 * Marks the inbox read once, on arrival.
 *
 * This used to happen inside the notifications page's render, which Next 15
 * rejects outright: `revalidatePath` during a render throws, and the whole
 * screen 500s. Clearing an inbox is a side effect of *visiting*, so it belongs
 * in an effect that calls the server action — where the revalidate is allowed
 * and the alert badge in the shell updates with it.
 */
export function MarkRead({ unread }: { unread: number }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current || unread <= 0) return;
    done.current = true;
    void markNotificationsReadAction();
  }, [unread]);

  return null;
}
