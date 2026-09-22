import { colorFromString, monogramInitials } from '../lib/normalize';

type Props = {
  name: string;
  logoUrl?: string | null;
  size?: number;
};

export function OrgLogo({ name, logoUrl, size = 160 }: Props) {
  if (logoUrl) {
    return (
      <img
        className="org-logo"
        src={logoUrl}
        alt={name}
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = monogramInitials(name);
  const bg = colorFromString(name);

  return (
    <div
      className="org-monogram"
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.36,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
