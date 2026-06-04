import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HrLeaders.css';

const POSITIONS = ['ALL', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

export default function HrLeaders() {
  const [data, setData] = useState(null);
  const [activePos, setActivePos] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/hr-leaders`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => { setError('Failed to load HR leaders.'); setLoading(false); });
  }, []);

  const rows = data
    ? (activePos === 'ALL' ? data.all : data.positions[activePos] || [])
    : [];

  return (
    <div className="hr-leaders">
      <h3 className="hr-leaders-title">MLB HR Leaders</h3>

      <div className="hr-leaders-tabs">
        {POSITIONS.map(pos => (
          <button
            key={pos}
            className={`hr-leaders-tab ${activePos === pos ? 'active' : ''}`}
            onClick={() => setActivePos(pos)}
          >
            {pos}
          </button>
        ))}
      </div>

      {loading && <p className="hr-leaders-status">LOADING...</p>}
      {error && <p className="hr-leaders-status hr-leaders-error">{error}</p>}

      {!loading && !error && (
        <table className="hr-leaders-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              {activePos === 'ALL' && <th>POS</th>}
              <th>HR</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={activePos === 'ALL' ? 5 : 4} className="hr-leaders-empty">No data</td></tr>
            ) : rows.map((row, i) => (
              <tr key={row.player_id} className={i === 0 ? 'hr-leaders-top' : ''}>
                <td className="hr-leaders-rank">{row.pos_rank}</td>
                <td className="hr-leaders-name">{row.name}</td>
                {activePos === 'ALL' && <td className="hr-leaders-pos">{row.primary_position}</td>}
                <td className="hr-leaders-hr">{row.total_hrs}</td>
                <td className="hr-leaders-owner">{row.manager_name || <span className="hr-leaders-free">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}