import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { PixelSprite, formatContext } from '../badges/PixelBadge';
import { byKey } from '../badges/definitions';
import './ActivityFeed.css';

function fmtDate(d) {
  // event_date is a DATE — parse as local noon to avoid UTC-midnight → previous-day in US TZs
  const [y, m, day] = String(d).split('T')[0].split('-').map(Number);
  const dt = new Date(y, m - 1, day);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function BadgeInline({ badgeKey, context }) {
  const def = byKey[badgeKey];
  if (!def) return <span className="feed-badge-content">{badgeKey}</span>;
  const ctxLine = formatContext(def, context);
  const hover = ctxLine ? `${def.desc} — ${ctxLine}` : def.desc;
  return (
    <span className="feed-badge-content" title={hover}>
      <PixelSprite sprite={def.sprite} size={16} />
      <span className={`feed-badge-name tier-${def.tier}`}>{def.name}</span>
    </span>
  );
}

function HrEvent({ e }) {
  const p = e.payload;
  const multi = p.of > 1 ? ` (${p.hr_number}/${p.of})` : '';
  return (
    <>
      <span className="feed-team">{e.manager_name}</span>
      <span className="feed-hr-player">{p.player_name}</span>
      <span className="feed-hr-pos">{p.position}</span>
      <span className="feed-hr-tag">HR{multi}</span>
    </>
  );
}

function BadgeEvent({ e }) {
  return (
    <>
      <span className="feed-team">{e.manager_name}</span>
      <span className="feed-verb">earned a badge!</span>
      <BadgeInline badgeKey={e.payload.badge_key} context={e.payload.context} />
    </>
  );
}

function TitleChangeEvent({ e }) {
  const p = e.payload;
  if (p.kind === 'loss') {
    return (
      <>
        <span className="feed-team">{e.manager_name}</span>
        <span className="feed-verb">lost a title</span>
        <BadgeInline badgeKey={p.badge_key} context={p.context} />
      </>
    );
  }
  const verb = p.prev_manager_name ? 'took a title!' : 'claimed a title!';
  return (
    <>
      <span className="feed-team">{e.manager_name}</span>
      <span className="feed-verb">{verb}</span>
      <BadgeInline badgeKey={p.badge_key} context={p.context} />
      {p.prev_manager_name && (
        <span className="feed-from">from {p.prev_manager_name}</span>
      )}
    </>
  );
}

function RosterMoveEvent({ e }) {
  const p = e.payload.player;
  return (
    <>
      <span className="feed-team">{e.manager_name}</span>
      <span className="feed-swap">{p.name} {p.from}→{p.to}</span>
    </>
  );
}

function RosterSwapEvent({ e }) {
  const p = e.payload;
  return (
    <>
      <span className="feed-team">{e.manager_name}</span>
      <span className="feed-swap">
        {p.player1.name} {p.player1.from}→{p.player1.to} ⇄ {p.player2.name}
      </span>
    </>
  );
}

const RENDERERS = {
  hr: HrEvent,
  badge: BadgeEvent,
  title_change: TitleChangeEvent,
  roster_swap: RosterSwapEvent,
  roster_move: RosterMoveEvent,
};

export default function ActivityFeed({ seasonId }) {
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cur) => {
    if (!seasonId) return;
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (cur) {
        params.set('before_date', String(cur.event_date).split('T')[0]);
        params.set('before_id', cur.id);
      }
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/feed/${seasonId}?${params}`
      );
      setEvents(prev => cur ? [...prev, ...res.data.events] : res.data.events);
      setCursor(res.data.next_cursor);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load feed:', err);
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => { load(null); }, [load]);

  if (!seasonId) return null;

  return (
    <div className="activity-feed">
      <h3>Feed</h3>
      {loading && events.length === 0 && <div className="feed-loading">Loading...</div>}
      {!loading && events.length === 0 && <div className="feed-empty">Nothing yet.</div>}
      <ul className="feed-list">
        {events.map(e => {
          const Renderer = RENDERERS[e.event_type];
          return (
            <li key={e.id} className={`feed-row feed-${e.event_type}`}>
              <span className="feed-date">{fmtDate(e.event_date)}</span>
              {Renderer ? <Renderer e={e} /> : <span>{e.event_type}</span>}
            </li>
          );
        })}
      </ul>
      {cursor && (
        <button className="feed-more" onClick={() => load(cursor)}>Load more</button>
      )}
    </div>
  );
}
