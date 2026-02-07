import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './AdminPortal.css';

const AdminPortal = () => {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('season');

  // New season form
  const [newSeason, setNewSeason] = useState({
    name: 'Dong Bong League',
    season_year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    source_league_id: ''
  });

  // New user form
  const [newUser, setNewUser] = useState({ email: '', password: '' });

  // New team form
  const [newTeam, setNewTeam] = useState({ league_id: '', name: '', manager_name: '' });

  // Draft setup
  const [draftLeagueId, setDraftLeagueId] = useState('');
  const [draftTeams, setDraftTeams] = useState([]);
  const [draftOrder, setDraftOrder] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [leaguesRes, usersRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/api/leagues`),
        axios.get(`${process.env.REACT_APP_API_URL}/api/admin/users`)
      ]);
      setLeagues(leaguesRes.data);
      setUsers(usersRes.data);
      if (leaguesRes.data.length > 0) {
        setNewSeason(prev => ({ ...prev, source_league_id: leaguesRes.data[0].id }));
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

  const handleNewSeason = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/admin/new-season`,
        newSeason
      );
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

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/admin/teams`, newTeam);
      showMessage(`Team "${newTeam.name}" created`);
      setNewTeam({ league_id: newTeam.league_id, name: '', manager_name: '' });
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const loadDraftTeams = async (leagueId) => {
    setDraftLeagueId(leagueId);
    if (!leagueId) return;
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/teams?league_id=${leagueId}`);
      setDraftTeams(response.data);
      setDraftOrder(response.data.map((t, i) => ({ team_id: t.id, order_position: i + 1, name: t.name, manager_name: t.manager_name })));
    } catch (err) {
      console.error(err);
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

  const handleCreateDraft = async () => {
    if (!draftLeagueId || draftOrder.length === 0) {
      showMessage('Select a league and set the draft order first');
      return;
    }
    try {
      // Create draft
      const draftRes = await axios.post(`${process.env.REACT_APP_API_URL}/api/draft`, {
        league_id: draftLeagueId,
        draft_type: 'snake',
        rounds: 11
      });
      const draftId = draftRes.data.draft.id;

      // Set order
      const orderRes = await axios.post(`${process.env.REACT_APP_API_URL}/api/draft/${draftId}/order`, {
        order: draftOrder.map(t => ({ team_id: t.team_id, order_position: t.order_position }))
      });

      showMessage(`Draft created! ${orderRes.data.message}`);
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleStartDraft = async () => {
    try {
      // Get existing draft for the league
      const draftRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/draft/league/${draftLeagueId}`);
      if (!draftRes.data.draft) {
        showMessage('No draft found. Create one first.');
        return;
      }
      await axios.post(`${process.env.REACT_APP_API_URL}/api/draft/${draftRes.data.draft.id}/start`);
      showMessage('Draft started! Go to the draft board to make picks.');
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  if (!user?.commissionerLeagues?.length) {
    return (
      <div className="admin-portal">
        <h2>Commissioner Access Required</h2>
        <p>You must be logged in as a commissioner to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="admin-loading">Loading admin panel...</div>;
  }

  return (
    <div className="admin-portal">
      <h2>Commissioner Portal</h2>

      {message && <div className="admin-message">{message}</div>}

      <div className="admin-tabs">
        <button className={activeTab === 'season' ? 'active' : ''} onClick={() => setActiveTab('season')}>
          New Season
        </button>
        <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
          Users
        </button>
        <button className={activeTab === 'teams' ? 'active' : ''} onClick={() => setActiveTab('teams')}>
          Teams
        </button>
        <button className={activeTab === 'draft' ? 'active' : ''} onClick={() => setActiveTab('draft')}>
          Draft
        </button>
      </div>

      {activeTab === 'season' && (
        <div className="admin-section">
          <h3>Create New Season</h3>
          <p className="admin-hint">This will create a new league, clone teams and roster templates from a previous season, and reassign users.</p>
          <form onSubmit={handleNewSeason} className="admin-form">
            <div className="form-row">
              <label>League Name</label>
              <input
                type="text"
                value={newSeason.name}
                onChange={e => setNewSeason({ ...newSeason, name: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>Season Year</label>
              <input
                type="number"
                value={newSeason.season_year}
                onChange={e => setNewSeason({ ...newSeason, season_year: parseInt(e.target.value, 10) })}
                required
              />
            </div>
            <div className="form-row">
              <label>Start Date</label>
              <input
                type="date"
                value={newSeason.start_date}
                onChange={e => setNewSeason({ ...newSeason, start_date: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>End Date</label>
              <input
                type="date"
                value={newSeason.end_date}
                onChange={e => setNewSeason({ ...newSeason, end_date: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>Copy From Season</label>
              <select
                value={newSeason.source_league_id}
                onChange={e => setNewSeason({ ...newSeason, source_league_id: e.target.value })}
              >
                <option value="">Start Fresh</option>
                {leagues.map(l => (
                  <option key={l.id} value={l.id}>{l.season_year} — {l.name}</option>
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

          <div className="admin-list">
            <h4>Existing Users</h4>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>
                      {u.assignments?.[0]?.role !== null
                        ? u.assignments.map(a => a.role).filter(Boolean).join(', ')
                        : 'unassigned'}
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4>Create New User</h4>
          <form onSubmit={handleCreateUser} className="admin-form">
            <div className="form-row">
              <label>Email</label>
              <input
                type="email"
                value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>Password</label>
              <input
                type="text"
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="admin-submit">Create User</button>
          </form>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="admin-section">
          <h3>Team Management</h3>

          <div className="admin-list">
            <h4>Teams by Season</h4>
            {leagues.map(league => (
              <div key={league.id} className="league-teams">
                <h5>{league.season_year} Season</h5>
                <ul>
                  {/* Teams will be loaded when we have a teams-by-league endpoint */}
                </ul>
              </div>
            ))}
          </div>

          <h4>Create New Team</h4>
          <form onSubmit={handleCreateTeam} className="admin-form">
            <div className="form-row">
              <label>League</label>
              <select
                value={newTeam.league_id}
                onChange={e => setNewTeam({ ...newTeam, league_id: e.target.value })}
                required
              >
                <option value="">Select League</option>
                {leagues.map(l => (
                  <option key={l.id} value={l.id}>{l.season_year} — {l.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Team Name</label>
              <input
                type="text"
                value={newTeam.name}
                onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>Manager Name</label>
              <input
                type="text"
                value={newTeam.manager_name}
                onChange={e => setNewTeam({ ...newTeam, manager_name: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="admin-submit">Create Team</button>
          </form>
        </div>
      )}

      {activeTab === 'draft' && (
        <div className="admin-section">
          <h3>Draft Setup</h3>

          <div className="form-row">
            <label>League</label>
            <select value={draftLeagueId} onChange={e => loadDraftTeams(e.target.value)}>
              <option value="">Select League</option>
              {leagues.map(l => (
                <option key={l.id} value={l.id}>{l.season_year} — {l.name}</option>
              ))}
            </select>
          </div>

          {draftOrder.length > 0 && (
            <>
              <h4>Draft Order (drag to reorder)</h4>
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

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button className="admin-submit" onClick={handleCreateDraft}>
                  Create Draft
                </button>
                <button className="admin-submit" onClick={handleStartDraft}>
                  Start Draft
                </button>
                <a
                  href={`/draft/${draftLeagueId}`}
                  className="admin-submit"
                  style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
                >
                  Go to Draft Board →
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPortal;
