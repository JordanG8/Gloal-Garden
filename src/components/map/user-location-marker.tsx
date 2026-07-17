'use client';

/**
 * Pokemon-Go-style "you are here" marker: a pulsing dot for position plus a
 * gradient facing-cone rotated to the device's compass heading, so the map
 * reads which way the phone is pointed the same way a live GPS game does.
 */
export function UserLocationMarker({ heading }: { heading: number | null }) {
  return (
    <div className="relative flex h-4 w-4 items-center justify-center" style={{ zIndex: 25 }}>
      {heading !== null && (
        <div
          className="pointer-events-none absolute"
          style={{
            width: 100,
            height: 100,
            left: -48,
            top: -48,
            transform: `rotate(${heading}deg)`,
            transformOrigin: '50% 50%',
            transition: 'transform 0.2s linear',
          }}
        >
          <svg width="100" height="100" viewBox="0 0 100 100">
            <defs>
              <radialGradient id="facingCone" cx="50%" cy="100%" r="70%">
                <stop offset="0%" stopColor="#4B87A8" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#4B87A8" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path d="M50 50 L22 6 A48 48 0 0 1 78 6 Z" fill="url(#facingCone)" />
          </svg>
        </div>
      )}
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-water opacity-60" />
      <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-water shadow-[0_0_0_2px_rgba(75,135,168,0.35)]" />
    </div>
  );
}
