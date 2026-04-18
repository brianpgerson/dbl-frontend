import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { resizeImageToDataURL } from '../utils/imageResize';

const API = process.env.REACT_APP_API_URL;

export default function BonusAdmin({ seasonId, onMessage }) {
  const [teams, setTeams] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [existingBadges, setExistingBadges] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [teamId, setTeamId] = useState('');
  const [hrs, setHrs] = useState(5);
  const [reason, setReason] = useState('');
  const [badgeMode, setBadgeMode] = useState('new'); // 'new' | 'existing' | 'none'
  const [existingBadgeId, setExistingBadgeId] = useState('');
  const [badgeName, setBadgeName] = useState('');
  const [badgeDesc, setBadgeDesc] = useState('');
  const [imageData, setImageData] = useState(null);

  const msg = m => onMessage?.(m);

  const load = async () => {
    if (!seasonId) return;
    const [t, b, cb] = await Promise.all([
      axios.get(`${API}/api/teams?season_id=${seasonId}`),
      axios.get(`${API}/api/admin/bonuses/${seasonId}`),
      axios.get(`${API}/api/admin/custom-badges/${seasonId}`),
    ]);
    setTeams(t.data);
    setBonuses(b.data);
    setExistingBadges(cb.data);
  };

  useEffect(() => { load().catch(err => console.error(err)); }, [seasonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) { setImageData(null); return; }
    try {
      const dataUrl = await resizeImageToDataURL(f, 400, 0.85);
      setImageData(dataUrl);
    } catch (err) {
      msg(`Image error: ${err.message}`);
    }
  };

  const reset = () => {
    setTeamId(''); setReason(''); setBadgeName(''); setBadgeDesc('');
    setImageData(null); setExistingBadgeId('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!teamId) { msg('Pick a team'); return; }
    setSubmitting(true);
    try {
      let custom_badge;
      if (badgeMode === 'existing' && existingBadgeId) {
        custom_badge = { id: parseInt(existingBadgeId, 10) };
      } else if (badgeMode === 'new' && badgeName) {
        custom_badge = { name: badgeName, description: badgeDesc || null, image_data: imageData };
      }
      const res = await axios.post(`${API}/api/admin/bonuses`, {
        season_id: seasonId,
        team_id: parseInt(teamId, 10),
        hrs: parseInt(hrs, 10),
        reason: reason || null,
        custom_badge,
      });
      msg(`+${hrs} awarded${res.data.custom_badge_name ? ` — badge "${res.data.custom_badge_name}"` : ''}`);
      reset();
      load();
    } catch (err) {
      msg(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (id) => {
    try {
      await axios.delete(`${API}/api/admin/bonuses/${id}`);
      msg('Bonus revoked');
      load();
    } catch (err) {
      msg(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  return (
    <div className="admin-section">
      <h3>Bonus HRs + Custom Badges</h3>

      <form onSubmit={submit} className="admin-form">
        <div className="form-row">
          <label>Team</label>
          <select value={teamId} onChange={e => setTeamId(e.target.value)} required>
            <option value="">Select team</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.manager_name} — {t.name}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label>Bonus HRs</label>
          <input type="number" min="1" value={hrs} onChange={e => setHrs(e.target.value)} required />
        </div>

        <div className="form-row">
          <label>Reason</label>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                 placeholder="e.g. Stadium selfie" maxLength={200} />
        </div>

        <div className="form-row">
          <label>Badge</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <label><input type="radio" checked={badgeMode === 'new'} onChange={() => setBadgeMode('new')} /> New</label>
            <label><input type="radio" checked={badgeMode === 'existing'} onChange={() => setBadgeMode('existing')} /> Existing</label>
            <label><input type="radio" checked={badgeMode === 'none'} onChange={() => setBadgeMode('none')} /> None</label>
          </div>
        </div>

        {badgeMode === 'new' && (
          <>
            <div className="form-row">
              <label>Badge name</label>
              <input type="text" value={badgeName} onChange={e => setBadgeName(e.target.value)} maxLength={80} />
            </div>
            <div className="form-row">
              <label>Description</label>
              <input type="text" value={badgeDesc} onChange={e => setBadgeDesc(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Image</label>
              <input type="file" accept="image/*" onChange={handleFile} />
              {imageData && (
                <img src={imageData} alt="preview" style={{ maxWidth: 120, marginTop: 8, border: '1px solid #39ff14' }} />
              )}
            </div>
          </>
        )}

        {badgeMode === 'existing' && (
          <div className="form-row">
            <label>Pick badge</label>
            <select value={existingBadgeId} onChange={e => setExistingBadgeId(e.target.value)}>
              <option value="">Select badge</option>
              {existingBadges.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        <button type="submit" className="admin-submit" disabled={submitting}>
          {submitting ? 'Awarding…' : 'Award Bonus'}
        </button>
      </form>

      {bonuses.length > 0 && (
        <table className="admin-table" style={{ marginTop: 20 }}>
          <thead>
            <tr><th>Date</th><th>Team</th><th>+HRs</th><th>Reason</th><th>Badge</th><th></th></tr>
          </thead>
          <tbody>
            {bonuses.map(b => (
              <tr key={b.id}>
                <td>{String(b.awarded_date).split('T')[0]}</td>
                <td>{b.manager_name}</td>
                <td>+{b.hrs}</td>
                <td>{b.reason || '—'}</td>
                <td>{b.custom_badge_name || '—'}</td>
                <td><button type="button" onClick={() => revoke(b.id)} className="admin-danger">Revoke</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
