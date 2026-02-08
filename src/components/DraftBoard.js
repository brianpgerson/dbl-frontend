import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './DraftBoard.css';

const POSITIONS = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH', 'BEN'];

const DraftBoard = ({ seasonId }) => {
  const { user } = useAuth();
  const [draftData, setDraftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [message, setMessage] = useState('');
  const [editingPick, setEditingPick] = useState(null); // { pick_number, current_position }

  const isCommissioner = user?.commissionerLeagueIds?.length > 0;

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  const loadDraft = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/draft/season/${seasonId}`
      );
      setDraftData(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading draft:', err);
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    loadDraft();
    const interval = setInterval(loadDraft, 10000);
    return () => clearInterval(interval);
  }, [loadDraft]);

  const searchPlayers = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/draft/${draftData.draft.id}/available?q=${encodeURIComponent(query)}`
      );
      setSearchResults(response.data);
    } catch (err) {
      console.error('Error searching players:', err);
    }
  };

  const makePick = async (playerId) => {
    if (!selectedPosition) {
      showMessage('Select a roster position first');
      return;
    }
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/draft/${draftData.draft.id}/pick`,
        { player_id: playerId, position: selectedPosition }
      );
      showMessage(`Pick #${response.data.pick.pick_number}: ${response.data.pick.player_name} (${response.data.pick.position})`);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPosition('');
      loadDraft();
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const undoPick = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/draft/${draftData.draft.id}/undo`
      );
      showMessage(response.data.message);
      loadDraft();
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const editPickPosition = async (pickNumber, newPosition) => {
    try {
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/draft/${draftData.draft.id}/pick/${pickNumber}`,
        { position: newPosition }
      );
      showMessage(response.data.message);
      setEditingPick(null);
      loadDraft();
    } catch (err) {
      showMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handlePickCellClick = (pick) => {
    if (!isCommissioner || !pick.player_id) return;
    if (editingPick?.pick_number === pick.pick_number) {
      setEditingPick(null);
    } else {
      setEditingPick({ pick_number: pick.pick_number, current_position: pick.position });
    }
  };

  if (loading) {
    return <div className="draft-loading">Loading draft...</div>;
  }

  if (!draftData?.draft) {
    return (
      <div className="draft-board">
        <h2>Draft</h2>
        <p className="draft-empty">No draft has been set up for this season yet.</p>
        {isCommissioner && (
          <p className="draft-hint">Go to the Admin portal to create a draft.</p>
        )}
      </div>
    );
  }

  const { draft, order, picks, on_the_clock } = draftData;

  // Group picks by round
  const picksByRound = {};
  picks.forEach(pick => {
    if (!picksByRound[pick.round]) picksByRound[pick.round] = [];
    picksByRound[pick.round].push(pick);
  });

  // Count picks made
  const picksMade = picks.filter(p => p.player_id).length;

  return (
    <div className="draft-board">
      <h2>Draft Board</h2>

      {/* Status bar */}
      <div className={`draft-status status-${draft.status}`}>
        {draft.status === 'setup' && 'DRAFT NOT STARTED'}
        {draft.status === 'active' && on_the_clock && (
          <>
            ON THE CLOCK: <span className="clock-team">{on_the_clock.manager_name}'s {on_the_clock.team_name}</span>
            <span className="clock-pick">Pick #{on_the_clock.pick_number} (Round {on_the_clock.round}) — {picksMade}/{draft.total_picks} picks made</span>
          </>
        )}
        {draft.status === 'complete' && `DRAFT COMPLETE — ${picksMade} picks`}
      </div>

      {message && <div className="draft-message">{message}</div>}

      {/* Commissioner controls */}
      {isCommissioner && (draft.status === 'active' || draft.status === 'complete') && (
        <div className="commissioner-controls">
          {draft.status === 'active' && (
            <>
              <h3>Make Pick</h3>
              <div className="pick-controls">
                <div className="position-select">
                  <label>Position:</label>
                  <select value={selectedPosition} onChange={e => setSelectedPosition(e.target.value)}>
                    <option value="">Select...</option>
                    {POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
                <div className="player-search">
                  <label>Search Player:</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => searchPlayers(e.target.value)}
                    placeholder="Type player name..."
                  />
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map(player => (
                    <div key={player.id} className="search-result" onClick={() => makePick(player.id)}>
                      <span className="result-name">{player.name}</span>
                      <span className="result-pos">{player.primary_position}</span>
                    </div>
                  ))}
                </div>
              )}

              <button className="undo-button" onClick={undoPick}>Undo Last Pick</button>
            </>
          )}

          {editingPick && (
            <div className="edit-position-bar">
              <span className="edit-label">Change position for pick #{editingPick.pick_number}:</span>
              <div className="edit-position-buttons">
                {POSITIONS.map(pos => (
                  <button
                    key={pos}
                    className={`edit-pos-btn ${pos === editingPick.current_position ? 'current' : ''}`}
                    onClick={() => editPickPosition(editingPick.pick_number, pos)}
                  >
                    {pos}
                  </button>
                ))}
                <button className="edit-pos-cancel" onClick={() => setEditingPick(null)}>Cancel</button>
              </div>
            </div>
          )}

          {!editingPick && draft.status !== 'setup' && (
            <p className="edit-hint">Tap any pick to change its position</p>
          )}
        </div>
      )}

      {/* Draft board grid */}
      <div className="draft-grid">
        <table>
          <thead>
            <tr>
              <th>Rd</th>
              {order.map(team => (
                <th key={team.team_id} className="team-header">
                  <div className="team-header-name">{team.manager_name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(picksByRound).map(([round, roundPicks]) => (
              <tr key={round}>
                <td className="round-number">{round}</td>
                {roundPicks.map(pick => (
                  <td
                    key={pick.pick_number}
                    className={`pick-cell ${pick.player_id ? 'picked' : 'pending'} ${
                      on_the_clock?.pick_number === pick.pick_number ? 'on-clock' : ''
                    } ${editingPick?.pick_number === pick.pick_number ? 'editing' : ''} ${
                      isCommissioner && pick.player_id ? 'editable' : ''
                    }`}
                    onClick={() => handlePickCellClick(pick)}
                  >
                    {pick.player_id ? (
                      <div className="pick-info">
                        <div className="pick-player">{pick.player_name?.split(' ').pop()}</div>
                        <div className="pick-position">{pick.position}</div>
                      </div>
                    ) : (
                      <div className="pick-empty">—</div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DraftBoard;
