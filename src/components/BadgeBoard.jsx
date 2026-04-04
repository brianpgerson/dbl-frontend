import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PixelBadge from '../badges/PixelBadge';
import { BADGES, TIER_ORDER } from '../badges/definitions';
import './BadgeBoard.css';

export default function BadgeBoard({ teamId, seasonId }) {
  const [earned, setEarned] = useState({}); // { badge_key: {context, awarded_date?} }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !seasonId) { setLoading(false); return; }
    setLoading(true);
    axios
      .get(`${process.env.REACT_APP_API_URL}/api/badges/${seasonId}/team/${teamId}`)
      .then(res => {
        const map = {};
        // Achievements: may have multiple awards per key — keep the earliest
        (res.data.awards || []).forEach(a => {
          if (!map[a.badge_key]) {
            map[a.badge_key] = { context: a.context, awarded_date: a.awarded_date };
          }
        });
        // Titles: currently held
        (res.data.titles || []).forEach(t => {
          map[t.badge_key] = { context: t.context };
        });
        setEarned(map);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load badges:', err);
        setLoading(false);
      });
  }, [teamId, seasonId]);

  const earnedCount = Object.keys(earned).length;

  return (
    <div className="badge-board">
      <div className="badge-board-header">
        <h3>Badges</h3>
        {!loading && <span className="badge-board-count">{earnedCount}/{BADGES.length}</span>}
      </div>
      {TIER_ORDER.map(tier => {
        const tierBadges = BADGES.filter(b => b.tier === tier);
        return (
          <div key={tier} className="badge-board-tier">
            <div className={`badge-board-tier-label tier-${tier}`}>{tier}</div>
            <div className="badge-board-grid">
              {tierBadges.map(b => {
                const e = earned[b.key];
                return (
                  <PixelBadge
                    key={b.key}
                    badgeKey={b.key}
                    locked={!e}
                    context={e?.context}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
