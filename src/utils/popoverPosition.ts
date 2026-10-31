/**
 * Smart Popover & Dropdown Viewport Boundary Engine
 * Ensures any dropdown, popover, or floating menu appears strictly
 * WITHIN the browser viewport boundaries without clipping, overflow, or errors.
 */
import type React from 'react';

export interface TriggerRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export interface PopoverPositionOptions {
  preferredWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: number;
  offset?: number;
  padding?: number;
  align?: 'end' | 'start' | 'center'; // In RTL, 'end' aligns with right edge
  forceDirection?: 'up' | 'down';
}

export interface CalculatedPopoverPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  openUpward: boolean;
  align: 'end' | 'start' | 'center';
}

export type PopoverCoords = CalculatedPopoverPosition;

/**
 * Calculates intelligent coordinates for any floating popover / dropdown.
 * - Auto flips vertically if there is not enough room below
 * - Smart bottom anchoring when opening upward to prevent floating gaps
 * - Auto clamps horizontally so it never exceeds screen edges (left or right)
 * - Automatically restricts maxHeight and enables smooth internal scrolling
 */
export function calculateSmartPopoverPosition(
  triggerRect: TriggerRect,
  estimatedHeight: number,
  options: PopoverPositionOptions = {}
): CalculatedPopoverPosition {
  const padding = options.padding ?? 10;
  const offset = options.offset ?? 6;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Determine width with screen containment
  const preferredWidth = options.preferredWidth ?? Math.max(220, triggerRect.width);
  const minWidth = options.minWidth ?? 160;
  const maxAllowedWidth = Math.min(options.maxWidth ?? 460, viewportWidth - padding * 2);
  let width = Math.max(minWidth, Math.min(preferredWidth, maxAllowedWidth));
  if (width > viewportWidth - padding * 2) {
    width = Math.max(minWidth, viewportWidth - padding * 2);
  }

  // Determine vertical available space
  const desiredMaxH = options.maxHeight ?? 520;
  const spaceBelow = Math.max(0, viewportHeight - triggerRect.bottom - offset - padding);
  const spaceAbove = Math.max(0, triggerRect.top - offset - padding);

  let openUpward = false;
  if (options.forceDirection === 'up') {
    openUpward = true;
  } else if (options.forceDirection === 'down') {
    openUpward = false;
  } else {
    // Flip upward only if space below is insufficient AND space above is meaningfully larger
    if (spaceBelow < Math.min(estimatedHeight, 260) && spaceAbove > spaceBelow + 40) {
      openUpward = true;
    }
  }

  // Calculate coordinates & maxHeight so the menu NEVER shrinks into a tiny clipped box
  let top: number | undefined;
  let bottom: number | undefined;
  let maxHeight: number;

  const targetHeight = Math.min(estimatedHeight, desiredMaxH, viewportHeight - padding * 2);

  if (openUpward && spaceAbove >= 220) {
    maxHeight = Math.min(desiredMaxH, Math.max(220, spaceAbove));
    bottom = Math.round(viewportHeight - triggerRect.top + offset);
    top = Math.max(padding, triggerRect.top - Math.min(targetHeight, maxHeight) - offset);
  } else if (spaceBelow >= targetHeight || spaceBelow >= 240) {
    openUpward = false;
    maxHeight = Math.min(desiredMaxH, Math.max(240, spaceBelow));
    top = Math.round(triggerRect.bottom + offset);
    bottom = undefined;
  } else {
    // Viewport is tight both above and below: float over the page clamped to viewport bounds so no items are hidden
    openUpward = false;
    maxHeight = Math.min(desiredMaxH, Math.max(260, viewportHeight - padding * 2));
    const idealTop = Math.round(triggerRect.bottom + offset);
    const maxTop = Math.max(padding, viewportHeight - targetHeight - padding);
    top = Math.max(padding, Math.min(idealTop, maxTop));
    bottom = undefined;
  }

  // Determine horizontal positioning (RTL aware: default is align to right edge)
  let left: number;
  const align = options.align ?? 'end'; // 'end' in RTL = right edge

  if (align === 'end') {
    // Right edge aligned with trigger's right edge
    left = triggerRect.right - width;
  } else if (align === 'start') {
    // Left edge aligned with trigger's left edge
    left = triggerRect.left;
  } else {
    // Center aligned
    left = triggerRect.left + (triggerRect.width / 2) - (width / 2);
  }

  // Viewport bounds clamping (ensure 100% inside screen horizontally)
  if (left < padding) {
    left = padding;
  }
  if (left + width > viewportWidth - padding) {
    left = Math.max(padding, viewportWidth - width - padding);
  }

  return {
    top: top !== undefined ? Math.round(top) : undefined,
    bottom: bottom !== undefined ? Math.round(bottom) : undefined,
    left: Math.round(left),
    width: Math.round(width),
    maxHeight: Math.round(maxHeight),
    openUpward,
    align
  };
}

/**
 * Helper to convert CalculatedPopoverPosition into React.CSSProperties
 * Automatically anchors via `bottom` when opening upward to guarantee zero gap and zero offscreen clipping.
 */
export function getPopoverStyle(pos: CalculatedPopoverPosition): React.CSSProperties {
  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${pos.left}px`,
    width: `${pos.width}px`,
    maxHeight: `${pos.maxHeight}px`,
    zIndex: 999999,
    overflowY: 'auto'
  };

  if (pos.openUpward && pos.bottom !== undefined) {
    style.bottom = `${pos.bottom}px`;
    style.top = 'auto';
  } else if (pos.top !== undefined) {
    style.top = `${pos.top}px`;
    style.bottom = 'auto';
  }

  return style;
}
