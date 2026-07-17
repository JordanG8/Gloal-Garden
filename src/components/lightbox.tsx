'use client';

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/i18n/provider';
import { IconClose } from '@/components/icons';

const MAX_ZOOM = 3;
const DOUBLE_TAP_ZOOM = 2.4;
const DISMISS_THRESHOLD = 110;
const DOUBLE_TAP_MS = 300;

type Point = { x: number; y: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Instagram-style fullscreen photo viewer: double-tap or pinch to zoom, drag
 * to pan while zoomed, drag-down to dismiss otherwise. Built on Pointer Events
 * so mouse (desktop) and touch (phone) share one code path.
 */
export function Lightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const { dict } = useI18n();
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const pointers = useRef(new Map<number, Point>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const lastTap = useRef(0);

  function toggleZoom() {
    setScale((s) => (s > 1 ? 1 : DOUBLE_TAP_ZOOM));
    setPan({ x: 0, y: 0 });
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: distance(a, b), scale };
      panStart.current = null;
    } else if (pointers.current.size === 1) {
      setDragging(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        toggleZoom();
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const ratio = distance(a, b) / (pinchStart.current.dist || 1);
      setScale(Math.min(MAX_ZOOM, Math.max(1, pinchStart.current.scale * ratio)));
      return;
    }

    if (pointers.current.size === 1 && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (scale > 1) {
        setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
      } else if (dy > 0) {
        setDragY(dy);
      }
    }
  }

  function endGesture(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;

    setDragging(false);
    panStart.current = null;
    pinchStart.current = null;
    if (scale <= 1 && dragY > DISMISS_THRESHOLD) {
      onClose();
      return;
    }
    setDragY(0);
    if (scale < 1) setScale(1);
  }

  const bgOpacity = Math.max(0.15, 1 - dragY / 400);

  // Portalled to <body> so a `position: fixed` ancestor can't be trapped
  // inside an animated (transform-having) parent elsewhere in the tree —
  // e.g. the profile header's `animate-rise` wrapper, whose CSS animation
  // leaves a non-"none" transform in place after it finishes and would
  // otherwise become this element's containing block instead of the
  // viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex touch-none select-none items-center justify-center"
      style={{ background: `rgba(0,0,0,${bgOpacity})`, transition: dragging ? 'none' : 'background 0.25s' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={dict.common.close}
        className="absolute end-4 top-[max(env(safe-area-inset-top),16px)] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
      >
        <IconClose size={18} />
      </button>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-[90vh] max-w-[92vw] object-contain"
        style={{
          transform: `translate(${pan.x}px, ${pan.y + dragY}px) scale(${scale})`,
          transition: dragging ? 'none' : 'transform 0.25s ease-out',
        }}
      />
    </div>,
    document.body
  );
}
