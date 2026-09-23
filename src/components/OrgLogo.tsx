import { colorFromString, monogramInitials } from '../lib/normalize';

type Props = {
  name: string;
  logoUrl?: string | null;
  /** Base size in px — CSS can override via --org-logo-size on a parent */
  size?: number;
  className?: string;
};

export function OrgLogo({ name, logoUrl, size = 160, className }: Props) {
  const style = {
    ['--org-logo-size' as string]: `${size}px`,
  };

  if (logoUrl) {
    return (
      <img
        className={['org-logo', className].filter(Boolean).join(' ')}
        src={logoUrl}
        alt={name}
        style={style}
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
