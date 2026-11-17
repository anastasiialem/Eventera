/** Лінійна електрогітара (single-cut) для блоку «Цього тижня у Львові». Колір — currentColor. */
export function Guitar({ className }: { className?: string }) {
  const frets = [196, 222, 246, 268, 289, 308, 326, 343, 359, 374, 388, 401]
  const strings = [81, 83.8, 86.6, 89.4, 92.2, 95]
  return (
    <svg
      aria-hidden
      viewBox="0 0 520 180"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* корпус */}
      <path d="M174 76c-12-6-22-18-42-20-18-2-26 8-38 6-22-4-62-12-70 26-6 42 38 72 78 62 20-5 28-18 45-18 15 0 25-8 23-22 4-6 4-14 4-22z" />
      <path d="M168 80c-10-4-18-14-36-16-16-1-24 8-38 6-20-3-54-8-62 22-5 36 32 62 68 54 18-4 26-16 42-16 13 0 21-6 20-18" strokeWidth={1} strokeDasharray="3 4" opacity={0.55} />
      {/* накладка */}
      <path d="M110 112c10 16 28 22 44 18 8-2 12-10 10-18" strokeWidth={1.2} />
      {/* звукознімачі */}
      <rect x="96" y="76" width="18" height="22" rx="3" />
      <rect x="130" y="76" width="18" height="22" rx="3" />
      <path d="M100 80v14M105 80v14M110 80v14M134 80v14M139 80v14M144 80v14" strokeWidth={0.8} />
      {/* бридж і струнотримач */}
      <rect x="76" y="75" width="7" height="24" rx="2" />
      <rect x="58" y="76" width="9" height="22" rx="2" />
      {/* ручки і перемикач */}
      <circle cx="56" cy="122" r="5.5" />
      <circle cx="78" cy="132" r="5.5" />
      <circle cx="46" cy="140" r="5.5" />
      <circle cx="68" cy="150" r="5.5" />
      <circle cx="122" cy="50" r="3.5" />
      {/* гриф */}
      <path d="M172 78h236v18H172z" />
      {frets.map((x) => (
        <path key={x} d={`M${x} 78v18`} strokeWidth={1.1} />
      ))}
      {[234, 279, 317, 351].map((x) => (
        <circle key={x} cx={x} cy={87} r={1.6} fill="currentColor" stroke="none" />
      ))}
      {/* голова грифа */}
      <path d="M408 78l10-6c18-10 40-14 60-12 10 1 16 6 18 12v30c-2 6-8 11-18 12-20 2-42-2-60-12l-10-6" />
      <path d="M408 82l64-4M408 92l64 4" strokeWidth={0.9} />
      {[430, 452, 474].map((x) => (
        <g key={x}>
          <path d={`M${x} ${66 - (x - 430) / 10}v-10`} />
          <rect x={x - 5} y={50 - (x - 430) / 10} width="10" height="7" rx="2" />
          <path d={`M${x} ${108 + (x - 430) / 10}v10`} />
          <rect x={x - 5} y={117 + (x - 430) / 10} width="10" height="7" rx="2" />
        </g>
      ))}
      {/* струни */}
      {strings.map((y) => (
        <path key={y} d={`M80 ${y}L472 ${y + (87 - y) * 0.35}`} strokeWidth={0.5} opacity={0.75} />
      ))}
    </svg>
  )
}
