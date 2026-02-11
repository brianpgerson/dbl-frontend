import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './AdminPortal.css';

const AdminPortal = () => {
  const { user, loading: authLoading } = useAuth();
  const [, setLeagues] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [users, setUsers] = useState([]);
  const [draftStatus, setDraftStatus] = useState(null); // null, 'setup', 'active', 'complete'
  const [draftData, setDraftData] = useState(null);
  const [activeLeague, setActiveLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('settings');

  // New user form
  const [newUser, setNewUser] = useState({ email: '', password: '', team_name: '' });

  // Draft setup
  const [draftOrder, setDraftOrder] = useState([]);

  // Settings
  const [rosterTemplates, setRosterTemplates] = useState([]);
  const [leagueName, setLeagueName] = useState('');
  const [seasonDates, setSeasonDates] = useState({ start_date: '', end_date: '' });

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading]);

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

      // Check draft status for active season
      if (activeSeason) {
        const draftRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/draft/season/${activeSeason.id}`);
        setDraftData(draftRes.data);
        setDraftStatus(draftRes.data.draft?.status || null);

        // Pre-load draft order and settings for preseason
        if (!draftRes.data.draft || draftRes.data.draft.status === 'setup') {
          const teamsRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/teams?season_id=${activeSeason.id}`);
          setDraftOrder(teamsRes.data.map((t, i) => ({
            team_id: t.id, order_position: i + 1, name: t.name, manager_name: t.manager_name
          })));

          // Load roster templates
          const templatesRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/admin/seasons/${activeSeason.id}/roster-templates`);
          setRosterTemplates(templatesRes.data);
        }

        // Load season dates and league name
        setSeasonDates({
          start_date: activeSeason.start_date?.split('T')[0] || '',
          end_date: activeSeason.end_date?.split('T')[0] || ''
        });
        setLeagueName(activeSeason.league_name || '');
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
  const [appState, setAppState] = useState(null);
  const [statusData, setStatusData] = useState(null);

  const loadStatus = () => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/status`)
      .then(res => {
        setAppState(res.data.state);
        setStatusData(res.data);
      })
      .catch(() => {});
  };

  useEffect(() => { loadStatus(); }, []);

  const getPortalState = () => {
    if (appState === 'offseason') return 'offseason';
    if (draftStatus === 'active') return 'draft';
    if (draftStatus === 'complete') return 'season';
    return 'preseason';
  };

  const portalState = getPortalState();

  // ---- PRESEASON HANDLERS ----

  const handleNewSeason = async () => {
    const ps = statusData?.next_platform_season;
    if (!ps) {
      showMessage('No upcoming platform season available');
      return;
    }
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/admin/new-season`, {
        league_id: activeLeague?.league_id || seasons[0]?.league_id,
        season_year: ps.year,
        start_date: ps.start_date,
        end_date: ps.end_date,
        source_season_id: activeLeague?.id || seasons[0]?.id
      });
      showMessage(response.data.message);
      loadData();
      loadStatus();
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleSaveSeasonDates = async () => {
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/api/admin/seasons/${activeLeague.id}`, seasonDates);
      showMessage('Season dates updated');
      loadData();
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleSaveLeagueName = async () => {
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/api/admin/leagues/${activeLeague.league_id}`, { name: leagueName });
      showMessage('League name updated');
      loadData();
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleSaveRosterTemplates = async () => {
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/api/admin/seasons/${activeLeague.id}/roster-templates`, {
        templates: rosterTemplates
      });
      showMessage('Roster templates updated');
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const updateTemplateCount = (index, newCount) => {
    const updated = [...rosterTemplates];
    updated[index] = { ...updated[index], count: parseInt(newCount, 10) || 0 };
    setRosterTemplates(updated);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/admin/users`, newUser);
      showMessage(`User ${newUser.email} created${newUser.team_name ? ` with team "${newUser.team_name}"` : ''}`);
      setNewUser({ email: '', password: '', team_name: '' });
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
        {portalState === 'offseason' && <span className="state-preseason">Offseason</span>}
        {portalState === 'preseason' && <span className="state-preseason">Preseason</span>}
        {portalState === 'draft' && <span className="state-draft">Draft Active</span>}
        {portalState === 'season' && <span className="state-season">{activeLeague?.season_year} Season</span>}
      </div>

      {message && <div className="admin-message">{message}</div>}

      {/* ============ OFFSEASON STATE ============ */}
      {portalState === 'offseason' && (
        <div className="admin-section">
          {statusData?.next_platform_season ? (
            <>
              <h3>Start {statusData.next_platform_season.year} Season</h3>
              <div className="new-season-summary">
                <p>This will:</p>
                <ul>
                  <li>Create the {statusData.next_platform_season.year} season</li>
                  <li>Copy all teams and managers from {activeLeague?.season_year || 'last season'}</li>
                  <li>Reassign all users to their teams</li>
                  <li>Set scoring dates: {statusData.next_platform_season.start_date} to {statusData.next_platform_season.end_date}</li>
                </ul>
              </div>
              <button className="admin-submit" onClick={handleNewSeason}>
                Start {statusData.next_platform_season.year} Season
              </button>
            </>
          ) : (
            <>
              <h3>Offseason</h3>
              <p className="admin-hint">The {activeLeague?.season_year || 'previous'} season has ended. No new platform season is available yet.</p>
            </>
          )}

        </div>
      )}

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
              Settings
            </button>
            <button className={activeTab === 'draft' ? 'active' : ''} onClick={() => setActiveTab('draft')}>
              Start Draft
            </button>
          </div>

          {activeTab === 'settings' && (
            <div className="admin-section">
              {/* League Name */}
              <h3>League Name</h3>
              <div className="settings-row">
                <input type="text" value={leagueName} onChange={e => setLeagueName(e.target.value)} className="settings-input" />
                <button className="admin-submit-sm" onClick={handleSaveLeagueName}>Save</button>
              </div>

              {/* Season Dates */}
              <h3>Season Dates</h3>
              <div className="settings-dates">
                <div className="form-row">
                  <label>Scoring Start</label>
                  <input type="date" value={seasonDates.start_date} onChange={e => setSeasonDates({ ...seasonDates, start_date: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Scoring End</label>
                  <input type="date" value={seasonDates.end_date} onChange={e => setSeasonDates({ ...seasonDates, end_date: e.target.value })} />
                </div>
                <button className="admin-submit-sm" onClick={handleSaveSeasonDates}>Save Dates</button>
              </div>

              {/* Roster Templates */}
              <h3>Roster Template</h3>
              <div className="roster-template-list">
                {rosterTemplates.map((t, i) => (
                  <div key={t.id || i} className="roster-template-item">
                    <span className="template-position">{t.position}</span>
                    <input
                      type="number"
                      min="0"
                      value={t.count}
                      onChange={e => updateTemplateCount(i, e.target.value)}
                      className="template-count-input"
                    />
                  </div>
                ))}
                <button className="admin-submit-sm" onClick={handleSaveRosterTemplates} style={{ marginTop: '10px' }}>Save Template</button>
              </div>

              {/* Users */}
              <h3>Users</h3>
              <table className="admin-table">
                <thead>
                  <tr><th>Email</th><th>Role</th></tr>
                </thead>
                <tbody>
                  {(users || []).map(u => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.league_roles?.length > 0 ? u.league_roles.map(r => r.role).join(', ') : 'member'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4>Add User</h4>
              <form onSubmit={handleCreateUser} className="admin-form">
                <div className="form-row">
                  <label>Email</label>
                  <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                </div>
                <div className="form-row">
                  <label>Password</label>
                  <input type="text" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                </div>
                <div className="form-row">
                  <label>Team Name</label>
                  <input type="text" value={newUser.team_name} onChange={e => setNewUser({ ...newUser, team_name: e.target.value })} placeholder="Optional" />
                </div>
                <button type="submit" className="admin-submit-sm">Add User</button>
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
