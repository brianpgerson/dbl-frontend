import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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

function BonusEvent({ e }) {
  const p = e.payload;
  return (
    <>
      <span className="feed-team">{e.manager_name}</span>
      <span className="feed-verb">got +{p.hrs} bonus HRs!</span>
      {p.custom_badge_name && (
        <span className="feed-badge-content" title={p.reason || ''}>
          <span className="feed-bonus-icon">📸</span>
          <span className="feed-badge-name tier-special">{p.custom_badge_name}</span>
        </span>
      )}
      {!p.custom_badge_name && p.reason && <span className="feed-from">{p.reason}</span>}
    </>
  );
}

const RENDERERS = {
  hr: HrEvent,
  badge: BadgeEvent,
  title_change: TitleChangeEvent,
  roster_swap: RosterSwapEvent,
  roster_move: RosterMoveEvent,
  bonus: BonusEvent,
};

// Native <select> option lists are drawn by the OS and can't be themed, so the
// menu is rebuilt as an ARIA listbox to match the app's pixel aesthetic.
function TeamFilterDropdown({ teams, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const options = useMemo(() => [
    { value: '', label: 'All teams' },
    ...teams.map(t => ({ value: String(t.id), label: `${t.manager_name} — ${t.name}` })),
  ], [teams]);

  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));

  useEffect(() => {
    if (!open) return;
    const onPointer = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  // Keep the highlighted row visible when arrowing through a scrolled menu.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIndex];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const openMenu = () => { setActiveIndex(selectedIndex); setOpen(true); };
  const choose = i => { onChange(options[i].value); setOpen(false); };

  const onKeyDown = e => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); }
    else if (e.key === 'End') { e.preventDefault(); setActiveIndex(options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(activeIndex); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="feed-team-select" ref={rootRef}>
      <button
        type="button"
        className={`feed-team-filter${open ? ' open' : ''}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="feed-team-listbox"
        aria-activedescendant={open ? `feed-team-opt-${activeIndex}` : undefined}
        aria-label="Filter feed by team"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="feed-team-value">{options[selectedIndex].label}</span>
        <span className="feed-team-caret" aria-hidden="true" />
      </button>
      {open && (
        <ul className="feed-team-menu" id="feed-team-listbox" role="listbox" ref={listRef}>
          {options.map((o, i) => (
            <li
              key={o.value || 'all'}
              id={`feed-team-opt-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={
                'feed-team-option' +
                (o.value === value ? ' selected' : '') +
                (i === activeIndex ? ' active' : '')
              }
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A single team is roughly 1/10 of the feed, so filtering one page leaves very few
// rows. When a filter is on we keep paging in the background until we have enough.
const TARGET_ROWS = 25;
const MAX_AUTO_PAGES = 8;

export default function ActivityFeed({ seasonId, teams = [] }) {
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState('');
  const loadingRef = useRef(false);
  const autoPagesRef = useRef(0);
  const listRef = useRef(null);
  const pendingScrollRef = useRef(null);

  const load = useCallback(async (cur) => {
    if (!seasonId || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
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
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => { load(null); }, [load]);

  const visible = useMemo(
    () => teamFilter ? events.filter(e => String(e.team_id) === teamFilter) : events,
    [events, teamFilter]
  );

  // Top up one page at a time; each append re-runs this until we hit the row
  // target, run out of feed, or burn the page budget.
  useEffect(() => {
    if (!teamFilter || loading || !cursor) return;
    if (visible.length >= TARGET_ROWS) return;
    if (autoPagesRef.current >= MAX_AUTO_PAGES) return;
    autoPagesRef.current += 1;
    load(cursor);
  }, [teamFilter, visible.length, cursor, loading, load]);

  useEffect(() => {
    const idx = pendingScrollRef.current;
    if (idx == null || loading || !listRef.current) return;
    const el = listRef.current.children[idx];
    if (!el) return;
    const list = listRef.current;
    list.scrollTop += el.getBoundingClientRect().top - list.getBoundingClientRect().top;
    pendingScrollRef.current = null;
  }, [visible, loading]);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.manager_name.localeCompare(b.manager_name)),
    [teams]
  );
  const filteredTeam = teamFilter
    ? teams.find(t => String(t.id) === teamFilter)
    : null;

  if (!seasonId) return null;

  return (
    <div className="activity-feed">
      <div className="feed-header">
        <h3>Feed</h3>
        {teams.length > 0 && (
          <TeamFilterDropdown
            teams={sortedTeams}
            value={teamFilter}
            onChange={v => { autoPagesRef.current = 0; setTeamFilter(v); }}
          />
        )}
      </div>
      {visible.length > 0 && (
        <ul className="feed-list" ref={listRef}>
          {visible.map(e => {
            const Renderer = RENDERERS[e.event_type];
            return (
              <li key={e.id} className={`feed-row feed-${e.event_type}`}>
                <span className="feed-date">{fmtDate(e.event_date)}</span>
                {Renderer ? <Renderer e={e} /> : <span>{e.event_type}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {loading && <div className="feed-loading">Loading...</div>}
      {!loading && visible.length === 0 && (
        <div className="feed-empty">
          {filteredTeam ? `No events for ${filteredTeam.manager_name} yet.` : 'Nothing yet.'}
        </div>
      )}
      {cursor && (
        <button
          className="feed-more"
          onClick={() => {
            autoPagesRef.current = 0;
            pendingScrollRef.current = visible.length;
            load(cursor);
          }}
        >Load more</button>
      )}
    </div>
  );
}
