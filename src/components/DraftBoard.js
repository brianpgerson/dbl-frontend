import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './DraftBoard.css';

const DEFAULT_POSITIONS = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH', 'BEN'];

// Map MLB primary position codes to our roster positions
// MLB API returns numeric codes: 2=C, 3=1B, 4=2B, 5=3B, 6=SS, 7=LF, 8=CF, 9=RF, 10=DH
const MLB_POSITION_MAP = {
  '2': 'C', '3': '1B', '4': '2B', '5': '3B', '6': 'SS',
  '7': 'LF', '8': 'CF', '9': 'RF', '10': 'DH',
  'O': 'LF', 'Y': 'DH',
  // Also support letter codes in case they appear
  'C': 'C', '1B': '1B', '2B': '2B', '3B': '3B', 'SS': 'SS',
  'LF': 'LF', 'CF': 'CF', 'RF': 'RF', 'DH': 'DH', 'OF': 'LF'
};

// Human-readable position labels for display
const POSITION_LABELS = {
  '2': 'C', '3': '1B', '4': '2B', '5': '3B', '6': 'SS',
  '7': 'LF', '8': 'CF', '9': 'RF', '10': 'DH', 'O': 'OF', 'Y': 'TWP'
};

const DraftBoard = ({ seasonId }) => {
  const { user } = useAuth();
  const [draftData, setDraftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [message, setMessage] = useState('');
  const [editingPick, setEditingPick] = useState(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [filledPositions, setFilledPositions] = useState([]);
  const [rosterPositions, setRosterPositions] = useState(DEFAULT_POSITIONS);

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

      // Load filled positions for the team on the clock
      if (response.data.draft && response.data.on_the_clock) {
        const filledRes = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/draft/${response.data.draft.id}/filled-positions/${response.data.on_the_clock.team_id}`
        );
        setFilledPositions(filledRes.data);
      }

      // Load roster template positions for this season
      try {
        const templatesRes = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/admin/seasons/${seasonId}/roster-templates`
        );
        if (templatesRes.data.length > 0) {
          // Expand templates: if BEN has count 2, we want ['BEN', 'BEN']
          const positions = [];
          templatesRes.data.forEach(t => {
            if (t.count > 0) positions.push(t.position);
          });
          setRosterPositions(positions.length > 0 ? positions : DEFAULT_POSITIONS);
        }
      } catch {} // Ignore if templates endpoint needs auth

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
        `${process.env.REACT_APP_API_URL}/api/draft/${draftData.draft.id}/available?q=${encodeURIComponent(query)}&active_only=${activeOnly}`
      );
      setSearchResults(response.data);
    } catch (err) {
      console.error('Error searching players:', err);
    }
  };

  const selectPlayer = (player) => {
    setSelectedPlayer(player);
    setSearchQuery('');
    setSearchResults([]);

    // Auto-populate position from player's primary position if not already set
    if (!selectedPosition) {
      const mapped = MLB_POSITION_MAP[player.primary_position];
      if (mapped && rosterPositions.includes(mapped) && !isPositionFilled(mapped)) {
        setSelectedPosition(mapped);
      }
    }
  };

  const clearSelection = () => {
    setSelectedPlayer(null);
    setSelectedPosition('');
    setSearchQuery('');
    setSearchResults([]);
  };

  const isPositionFilled = (pos) => {
    // Count how many times this position appears in filled vs template
    const filledCount = filledPositions.filter(p => p === pos).length;
    const templateEntry = rosterPositions.filter(p => p === pos).length;
    return filledCount >= templateEntry;
  };

  const confirmPick = async () => {
    if (!selectedPlayer) {
      showMessage('Select a player first');
      return;
    }
    if (!selectedPosition) {
      showMessage('Select a roster position first');
      return;
    }
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/draft/${draftData.draft.id}/pick`,
        { player_id: selectedPlayer.id, position: selectedPosition }
      );
      showMessage(`Pick #${response.data.pick.pick_number}: ${response.data.pick.player_name} (${response.data.pick.position})`);
      clearSelection();
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

  const editPick = async (pickNumber, { position, player_id }) => {
    try {
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/draft/${draftData.draft.id}/pick/${pickNumber}`,
        { position, player_id }
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
      setEditingPick({
        pick_number: pick.pick_number,
        current_position: pick.position,
        current_player_id: pick.player_id,
        current_player_name: pick.player_name,
        team_id: pick.team_id
      });
    }
  };

  if (loading) return <div className="draft-loading">Loading draft...</div>;

  if (!draftData?.draft) {
    return (
      <div className="draft-board">
        <h2>Draft</h2>
        <p className="draft-empty">No draft has been set up for this season yet.</p>
        {isCommissioner && <p className="draft-hint">Go to the Admin portal to create a draft.</p>}
      </div>
    );
  }

  const { draft, order, picks, on_the_clock } = draftData;

  const picksByRound = {};
  picks.forEach(pick => {
    if (!picksByRound[pick.round]) picksByRound[pick.round] = [];
    picksByRound[pick.round].push(pick);
  });

  const picksMade = picks.filter(p => p.player_id).length;

  return (
    <div className="draft-board">
      <h2>Draft Board</h2>

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

              {/* Selected player display */}
              {selectedPlayer ? (
                <div className="selected-player-bar">
                  <span className="selected-label">Player:</span>
                  <span className="selected-name">{selectedPlayer.name}</span>
                  <span className="selected-pos-badge">{POSITION_LABELS[selectedPlayer.primary_position] || selectedPlayer.primary_position}</span>
                  <button className="clear-selection" onClick={clearSelection}>x</button>
                </div>
              ) : (
                <div className="pick-controls">
                  <div className="player-search">
                    <label>Search Player:</label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => searchPlayers(e.target.value)}
                      placeholder="Type player name..."
                    />
                    <label className="active-only-toggle">
                      <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
                      Active only
                    </label>
                  </div>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map(player => (
                    <div key={player.id} className="search-result" onClick={() => selectPlayer(player)}>
                      <span className="result-name">{player.name}</span>
                      <span className="result-pos">{POSITION_LABELS[player.primary_position] || player.primary_position}</span>
                      {player.status !== 'Active' && <span className="result-inactive">{player.status}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Position selector */}
              <div className="position-selector">
                <label>Position:</label>
                <div className="position-buttons">
                  {[...new Set(rosterPositions)].map(pos => {
                    const filled = isPositionFilled(pos);
                    return (
                      <button
                        key={pos}
                        className={`pos-btn ${selectedPosition === pos ? 'selected' : ''} ${filled ? 'filled' : ''}`}
                        onClick={() => !filled && setSelectedPosition(pos)}
                        disabled={filled}
                      >
                        {pos}
                        {filled && <span className="filled-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Confirm button */}
              <button
                className="confirm-pick-btn"
                onClick={confirmPick}
                disabled={!selectedPlayer || !selectedPosition}
              >
                {selectedPlayer && selectedPosition
                  ? `Draft ${selectedPlayer.name} as ${selectedPosition}`
                  : 'Select player and position'}
              </button>

            </>
          )}

          <div className="draft-controls-footer">
            <button className="undo-button" onClick={undoPick}>Undo Last Pick</button>
          </div>

          {editingPick && (
            <div className="edit-position-bar">
              <span className="edit-label">
                Edit pick #{editingPick.pick_number}: {editingPick.current_player_name} ({editingPick.current_position})
              </span>
              <div className="edit-position-buttons">
                {[...new Set(rosterPositions)].map(pos => (
                  <button
                    key={pos}
                    className={`edit-pos-btn ${pos === editingPick.current_position ? 'current' : ''}`}
                    onClick={() => editPick(editingPick.pick_number, { position: pos })}
                  >
                    {pos}
                  </button>
                ))}
                <button className="edit-pos-cancel" onClick={() => setEditingPick(null)}>Cancel</button>
              </div>
            </div>
          )}

          {!editingPick && draft.status !== 'setup' && (
            <p className="edit-hint">Tap any pick to edit position</p>
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
