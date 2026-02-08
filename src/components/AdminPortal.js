import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './AdminPortal.css';

const AdminPortal = () => {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [users, setUsers] = useState([]);
  const [draftStatus, setDraftStatus] = useState(null); // null, 'setup', 'active', 'complete'
  const [draftData, setDraftData] = useState(null);
  const [activeLeague, setActiveLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('settings');

  // New season form
  const [newSeason, setNewSeason] = useState({
    name: 'Dong Bong League',
    season_year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    source_season_id: ''
  });

  // New user form
  const [newUser, setNewUser] = useState({ email: '', password: '' });

  // Draft setup
  const [draftOrder, setDraftOrder] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [seasonsRes, leaguesRes, usersRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/api/leagues/seasons`),
        axios.get(`${process.env.REACT_APP_API_URL}/api/leagues`),
        axios.get(`${process.env.REACT_APP_API_URL}/api/admin/users`)
      ]);
      setLeagues(leaguesRes.data);
      setSeasons(seasonsRes.data);
      setUsers(usersRes.data);

      // Active season = most recent
      const seasons = seasonsRes.data;
      const activeSeason = seasons[0] || null;
      setActiveLeague(activeSeason); // reusing state name for now

      if (seasons.length > 0) {
        setNewSeason(prev => ({ ...prev, source_season_id: seasons[0].id, league_id: seasons[0].league_id }));
      }

      // Check draft status for active season
      if (activeSeason) {
        const draftRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/draft/season/${activeSeason.id}`);
        setDraftData(draftRes.data);
        setDraftStatus(draftRes.data.draft?.status || null);

        // Pre-load draft order for preseason
        if (!draftRes.data.draft || draftRes.data.draft.status === 'setup') {
          const teamsRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/teams?season_id=${activeSeason.id}`);
          setDraftOrder(teamsRes.data.map((t, i) => ({
            team_id: t.id, order_position: i + 1, name: t.name, manager_name: t.manager_name
          })));
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading admin data:', err);
      setLoading(false);
    }
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  // Determine the portal state
  const getPortalState = () => {
    if (!draftStatus || draftStatus === 'setup') return 'preseason';
    if (draftStatus === 'active') return 'draft';
    return 'season'; // complete
  };

  const portalState = getPortalState();

  // ---- PRESEASON HANDLERS ----

  const handleNewSeason = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/admin/new-season`, newSeason);
      showMessage(response.data.message);
      loadData();
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/admin/users`, newUser);
      showMessage(`User ${newUser.email} created`);
      setNewUser({ email: '', password: '' });
      loadData();
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const moveDraftOrder = (index, direction) => {
    const newOrder = [...draftOrder];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    newOrder.forEach((item, i) => { item.order_position = i + 1; });
    setDraftOrder(newOrder);
  };

  const handleStartDraft = async () => {
    if (!activeLeague || draftOrder.length === 0) {
      showMessage('No league or teams found');
      return;
    }
    try {
      const draftRes = await axios.post(`${process.env.REACT_APP_API_URL}/api/draft`, {
        season_id: activeLeague.id, draft_type: 'snake', rounds: 11
      });
      await axios.post(`${process.env.REACT_APP_API_URL}/api/draft/${draftRes.data.draft.id}/order`, {
        order: draftOrder.map(t => ({ team_id: t.team_id, order_position: t.order_position }))
      });
      await axios.post(`${process.env.REACT_APP_API_URL}/api/draft/${draftRes.data.draft.id}/start`);
      window.location.href = `/draft/${activeLeague.id}`;
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  // ---- DRAFT HANDLERS ----

  const handleCancelDraft = async () => {
    if (!draftData?.draft?.id) return;
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/draft/${draftData.draft.id}`);
      showMessage('Draft cancelled and reset');
      loadData();
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  // ---- SEASON HANDLERS ----

  const handleSyncHRs = async () => {
    try {
      showMessage('Syncing HR data...');
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/draft/sync-hrs`);
      showMessage(response.data.message);
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  // ---- RENDER ----

  if (!user?.commissionerLeagueIds?.length) {
    return (
      <div className="admin-portal">
        <h2>Commissioner Access Required</h2>
        <p className="draft-hint">You must be logged in as a commissioner to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="admin-loading">Loading admin panel...</div>;
  }

  return (
    <div className="admin-portal">
      <h2>Commissioner Portal</h2>
      <div className="portal-state-badge">
        {portalState === 'preseason' && <span className="state-preseason">Preseason</span>}
        {portalState === 'draft' && <span className="state-draft">Draft Active</span>}
        {portalState === 'season' && <span className="state-season">{activeLeague?.season_year} Season</span>}
      </div>

      {message && <div className="admin-message">{message}</div>}

      {/* ============ DRAFT ACTIVE STATE ============ */}
      {portalState === 'draft' && (
        <div className="admin-section draft-active-section">
          <h3>Draft In Progress</h3>
          <p className="admin-hint">
            {draftData?.on_the_clock
              ? `On the clock: ${draftData.on_the_clock.manager_name}'s ${draftData.on_the_clock.team_name} (Pick #${draftData.on_the_clock.pick_number})`
              : 'Draft is active'}
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a href={`/draft/${activeLeague.id}`} className="admin-submit" style={{ textDecoration: 'none', textAlign: 'center' }}>
              Go to Draft Board
            </a>
            <button className="admin-cancel" onClick={handleCancelDraft}>
              Cancel Draft
            </button>
          </div>
        </div>
      )}

      {/* ============ PRESEASON STATE ============ */}
      {portalState === 'preseason' && (
        <>
          <div className="admin-tabs">
            <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
              Season Setup
            </button>
            <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
              Users
            </button>
            <button className={activeTab === 'draft' ? 'active' : ''} onClick={() => setActiveTab('draft')}>
              Start Draft
            </button>
          </div>

          {activeTab === 'settings' && (
            <div className="admin-section">
              <h3>Create New Season</h3>
              <p className="admin-hint">Creates a new league, clones teams and roster templates from a previous season, and reassigns users.</p>
              <form onSubmit={handleNewSeason} className="admin-form">
                <div className="form-row">
                  <label>League Name</label>
                  <input type="text" value={newSeason.name} onChange={e => setNewSeason({ ...newSeason, name: e.target.value })} required />
                </div>
                <div className="form-row">
                  <label>Season Year</label>
                  <input type="number" value={newSeason.season_year} onChange={e => setNewSeason({ ...newSeason, season_year: parseInt(e.target.value, 10) })} required />
                </div>
                <div className="form-row">
                  <label>Start Date</label>
                  <input type="date" value={newSeason.start_date} onChange={e => setNewSeason({ ...newSeason, start_date: e.target.value })} required />
                </div>
                <div className="form-row">
                  <label>End Date</label>
                  <input type="date" value={newSeason.end_date} onChange={e => setNewSeason({ ...newSeason, end_date: e.target.value })} required />
                </div>
                <div className="form-row">
                  <label>Copy From Season</label>
                  <select value={newSeason.source_season_id} onChange={e => setNewSeason({ ...newSeason, source_season_id: e.target.value })}>
                    <option value="">Start Fresh</option>
                    {seasons.map(s => (
                      <option key={s.id} value={s.id}>{s.season_year} — {s.league_name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="admin-submit">Create Season</button>
              </form>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="admin-section">
              <h3>User Management</h3>
              <table className="admin-table">
                <thead>
                  <tr><th>Email</th><th>Role</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.assignments?.[0]?.role !== null ? u.assignments.map(a => a.role).filter(Boolean).join(', ') : 'unassigned'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4>Create New User</h4>
              <form onSubmit={handleCreateUser} className="admin-form">
                <div className="form-row">
                  <label>Email</label>
                  <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                </div>
                <div className="form-row">
                  <label>Password</label>
                  <input type="text" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                </div>
                <button type="submit" className="admin-submit">Create User</button>
              </form>
            </div>
          )}

          {activeTab === 'draft' && (
            <div className="admin-section">
              <h3>Draft Setup — {activeLeague?.season_year} Season</h3>

              {draftOrder.length > 0 ? (
                <>
                  <h4>Set Draft Order</h4>
                  <div className="draft-order-list">
                    {draftOrder.map((team, index) => (
                      <div key={team.team_id} className="draft-order-item">
                        <span className="order-number">{index + 1}.</span>
                        <span className="order-team">{team.manager_name}'s {team.name}</span>
                        <div className="order-buttons">
                          <button onClick={() => moveDraftOrder(index, -1)} disabled={index === 0}>↑</button>
                          <button onClick={() => moveDraftOrder(index, 1)} disabled={index === draftOrder.length - 1}>↓</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="admin-submit" onClick={handleStartDraft} style={{ marginTop: '15px' }}>
                    Start Draft
                  </button>
                </>
              ) : (
                <p className="admin-hint">No teams found for this league. Create a season first.</p>
              )}
            </div>
          )}
        </>
      )}

      {/* ============ SEASON STATE ============ */}
      {portalState === 'season' && (
        <div className="admin-section">
          <h3>{activeLeague?.season_year} Season Tools</h3>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <button className="admin-submit" onClick={handleSyncHRs}>
              Sync HR Data
            </button>
            <a href={`/draft/${activeLeague?.id}`} className="admin-submit" style={{ textDecoration: 'none', textAlign: 'center' }}>
              View Draft Results
            </a>
          </div>

          <p className="admin-hint">Roster swaps can be made from any team's roster page using the commissioner effective date override.</p>
        </div>
      )}
    </div>
  );
};

export default AdminPortal;
