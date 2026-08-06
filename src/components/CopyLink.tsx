'use client';

import { useState } from 'react';
import { Check, Link as LinkIcon } from './Icon';

/**
 * Copies the address of the page you are on.
 *
 * This replaced three icons in the market header that were drawn as buttons,
 * hovered like buttons, and did nothing at all — the most reported "button
 * doesn't work" in the app was a button that was never wired to anything.
 * Sharing a market is the one of the three that people actually wanted.
 */
export function CopyPageLink({ label = 'Copy link to this market' }: { label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="mk-tool pressable"
      aria-label={label}
      title={copied ? 'Link copied' : label}
      onClick={() => {
        navigator.clipboard?.writeText(window.location.href).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          },
          () => setCopied(false),
        );
      }}
    >
      {copied ? <Check size={16} weight={2} /> : <LinkIcon size={16} />}
    </button>
  );
}
