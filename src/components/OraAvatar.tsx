/**
 * Marque d'Ora : sceau carré à filet rouge, monogramme O et arc de délai.
 * L'arc se referme quand Ora réfléchit.
 */
export default function OraAvatar({ size = 40, actif = false }: { size?: number; actif?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Ora"
      className={actif ? "ora-actif" : undefined}
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="48" height="48" fill="#0a0a0a" />
      <rect width="48" height="4" fill="#e0111e" />
      <circle cx="24" cy="26" r="12" fill="none" stroke="#f7f4ee" strokeWidth="2.5" />
      <path
        className="ora-arc"
        d="M24 14 A12 12 0 0 1 36 26"
        fill="none"
        stroke="#e0111e"
        strokeWidth="3.5"
        strokeLinecap="square"
      />
    </svg>
  );
}
