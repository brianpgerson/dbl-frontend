import React from 'react';
import { SPRITES, PALETTE } from './sprites';
import { byKey } from './definitions';
import './PixelBadge.css';

// Raw sprite renderer — just the SVG, no card chrome.
export function PixelSprite({ sprite, size = 48 }) {
  const grid = SPRITES[sprite];
  if (!grid) return null;
  const dim = grid.length;
  const rects = [];
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = PALETTE[ch];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    });
  });
  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="pixel-sprite"
    >
      {rects}
    </svg>
  );
}

// Full badge card — sprite + name + desc, tier-colored glow, locked overlay.
export default function PixelBadge({ badgeKey, locked = false, context, size = 56 }) {
  const def = byKey[badgeKey];
  if (!def) return null;

  const contextLine = formatContext(def, context);

  return (
    <div
      className={`pixel-badge tier-${def.tier} ${locked ? 'locked' : ''}`}
      title={contextLine || def.desc}
    >
      <PixelSprite sprite={def.sprite} size={size} />
      <div className="pixel-badge-name">{def.name}</div>
      <div className="pixel-badge-desc">{contextLine || def.desc}</div>
    </div>
  );
}

export function formatContext(def, ctx) {
  if (!ctx) return null;
  if (ctx.player_name && ctx.streak != null) return `${ctx.player_name} — ${ctx.streak} straight`;
  if (ctx.player_name && ctx.bench_hrs != null) return `${ctx.player_name} — ${ctx.bench_hrs} bench HR`;
  if (ctx.player_name && ctx.hrs != null) return `${ctx.player_name} — ${ctx.hrs} HR`;
  if (ctx.player_name) return ctx.player_name;
  if (ctx.from != null && ctx.to != null) return `rank ${ctx.from} → ${ctx.to}`;
  if (ctx.rank != null) return `now rank ${ctx.rank}`;
  if (ctx.total != null) return `${ctx.total} HRs`;
  if (ctx.count != null) return `${ctx.count} in one day`;
  if (ctx.streak != null) return `${ctx.streak}-day streak`;
  if (ctx.gap != null) return `+${ctx.gap} lead`;
  if (ctx.positions != null) return `all ${ctx.positions} positions`;
  if (ctx.hrs != null) return `${ctx.hrs} HRs`;
  if (ctx.deficit != null) return `${ctx.deficit} back`;
  return null;
}
