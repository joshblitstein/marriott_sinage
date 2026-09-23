import type { CSSProperties } from 'react';
import { colorFromString, monogramInitials } from '../lib/normalize';

type Props = {
  name: string;
  logoUrl?: string | null;
  /**
   * Optional fixed size in px (admin tables).
   * Omit on displays so CSS --org-logo-size / clamp() can control sizing.
   */
  size?: number;
  className?: string;
};

export function OrgLogo({ name, logoUrl, size, className }: Props) {
  const style: CSSProperties | undefined =
    size != null
      ? ({ ['--org-logo-size' as string]: `${size}px` } as CSSProperties)
      : undefined;

  if (logoUrl) {
    return (
      <img
        className={['org-logo', className].filter(Boolean).join(' ')}
        src={logoUrl}
        alt={name}
        style={style}
        width={size ?? 160}
        height={size ?? 160}
        decoding="async"
      />
    );
  }

  const initials = monogramInitials(name);
  const bg = colorFromString(name);

  return (
    <div
      className={['org-monogram', className].filter(Boolean).join(' ')}
      style={{ ...style, background: bg }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
