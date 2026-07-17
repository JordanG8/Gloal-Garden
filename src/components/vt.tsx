'use client';

import * as React from 'react';

type VTComponent = React.ComponentType<{ name?: string; children: React.ReactNode }>;

// React's ViewTransition is stable in the bundled canary but typed under an
// unstable alias in some builds — resolve whichever exists, else passthrough.
const reactAny = React as unknown as Record<string, unknown>;
const VT: VTComponent =
  (reactAny.ViewTransition as VTComponent) ??
  (reactAny.unstable_ViewTransition as VTComponent) ??
  (({ children }) => <>{children}</>);

/** Shared-element morph wrapper (map sheet photo ↔ plant page hero). */
export function ViewT({ name, children }: { name?: string; children: React.ReactNode }) {
  return <VT name={name}>{children}</VT>;
}
