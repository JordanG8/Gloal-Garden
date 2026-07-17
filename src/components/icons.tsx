/**
 * Icon set traced from the Grove design file — thin 1.8px strokes, rounded
 * caps. Kept as tiny components so pins, tiles and tab bar match the mockups
 * exactly (lucide shapes differ subtly).
 */

export type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', ...props } as const;
}

export function IconDrop(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 3C12 3 6 10 6 14.5C6 17.8 8.7 20.5 12 20.5C15.3 20.5 18 17.8 18 14.5C18 10 12 3 12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M9.5 14.5C9.5 16 10.6 17 12 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconDropFilled(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 3C12 3 6 10 6 14.5C6 17.8 8.7 20.5 12 20.5C15.3 20.5 18 17.8 18 14.5C18 10 12 3 12 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconBasket(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 10H19L17.5 19H6.5L5 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 10C8.5 7 10 5 12 5C14 5 15.5 7 15.5 10" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

export function IconBasketFilled(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 10H19L17.5 19H6.5L5 10Z" fill="currentColor" />
      <path d="M8.5 10C8.5 7 10 5 12 5C14 5 15.5 7 15.5 10" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="7" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7L9.5 4.5H14.5L16 7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4L21 19H3L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10V14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconStar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 2L14.4 8.2L21 8.6L15.9 12.8L17.5 19.2L12 15.6L6.5 19.2L8.1 12.8L3 8.6L9.6 8.2L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconHeart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 21C8 17 5 13.5 5 10C5 7 7 5 9.5 5C10.5 5 11.5 5.5 12 6.3C12.5 5.5 13.5 5 14.5 5C17 5 19 7 19 10C19 13.5 16 17 12 21Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconHeartOutline(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 21C8 17 5 13.5 5 10C5 7 7 5 9.5 5C10.5 5 11.5 5.5 12 6.3C12.5 5.5 13.5 5 14.5 5C17 5 19 7 19 10C19 13.5 16 17 12 21Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPin(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 21C12 21 5 14.5 5 9.5C5 5.9 8.1 3 12 3C15.9 3 19 5.9 19 9.5C19 14.5 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="9.5" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function IconMap(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M9 20L3 17V4L9 7M9 20L15 17M9 20V7M15 17L21 20V7L15 4M15 17V4M9 7L15 4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconLeafPair(props: IconProps) {
  const { size = 20, ...rest } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" {...rest}>
      <path d="M10 17C10 11 13 5 18 3C18 10 15 15 10 17Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 17C10 12 8 7 2 5C2 11 5 15 10 17Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4H17V9C17 12 15 14 12 14C9 14 7 12 7 9V4Z" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M7 6H4V8C4 10 5.5 11 7 11M17 6H20V8C20 10 18.5 11 17 11M12 14V17M8.5 20H15.5M12 17V20"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4 20C4 16.7 7.6 14.5 12 14.5C16.4 14.5 20 16.7 20 20" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconLocate(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M20 4L10.5 13.5M20 4L13.5 20L10.5 13.5M20 4L4 10.5L10.5 13.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Chevron pointing "back" — flips automatically in RTL via CSS. */
export function IconBack(props: IconProps) {
  return (
    <svg {...base(props)} className={`rtl:-scale-x-100 ${props.className ?? ''}`}>
      <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Chevron pointing "forward". */
export function IconForward(props: IconProps) {
  return (
    <svg {...base(props)} className={`rtl:-scale-x-100 ${props.className ?? ''}`}>
      <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 9L12 16L19 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12.5L10 17.5L19 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8V12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function IconMail(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 7.5L12 13L20 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCrown(props: IconProps) {
  const { size = 24, ...rest } = props;
  return (
    <svg width={size} height={Math.round((size * 18) / 24)} viewBox="0 0 24 18" fill="none" {...rest}>
      <path d="M2 16H22L20 5L15 9L12 2L9 9L4 5L2 16Z" fill="currentColor" />
    </svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 3L13.8 9.2L20 11L13.8 12.8L12 19L10.2 12.8L4 11L10.2 9.2L12 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Full-color Google "G" mark for the OAuth button. */
export function IconGoogle(props: IconProps) {
  const { size = 20, ...rest } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.56-5.17 3.56-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.93.46 3.76 1.27 5.39l4-3.11Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

export function IconImage(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.5" cy="9.5" r="1.7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 17L9 12L13 16L16.5 12.5L20 16" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFlipCamera(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M4 8H8L9.5 5.5H14.5L16 8H20V19H4V8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 13.5C9 11.8 10.3 10.5 12 10.5C13 10.5 13.9 11 14.4 11.8M15 13.5C15 15.2 13.7 16.5 12 16.5C11 16.5 10.1 16 9.6 15.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M14.4 10.3V11.8H12.9M9.6 16.7V15.2H11.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGlobe(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12H21M12 3C14.5 5.5 15.8 8.6 15.8 12C15.8 15.4 14.5 18.5 12 21C9.5 18.5 8.2 15.4 8.2 12C8.2 8.6 9.5 5.5 12 3Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
