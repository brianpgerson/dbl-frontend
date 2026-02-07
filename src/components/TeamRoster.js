import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import PlayerSwapModal from './PlayerSwapModal';
import '../TeamRoster.css';

const TeamRoster = ({ team }) => {
  const { canManageTeam } = useAuth();
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  
  // Standard fantasy baseball roster order
  const positionOrder = {
    'C': 1,
    '1B': 2,
    '2B': 3,
    'SS': 4,
    '3B': 5,
    'LF': 6,
    'CF': 7,
    'RF': 8,
    'DH': 9,
    'BEN': 10  // Bench players go last
  };
  
  useEffect(() => {
    setLoading(true);
    axios.get(`${process.env.REACT_APP_API_URL}/api/team/${team.id}/roster-with-hrs`)
      .then(response => {
        setRoster(response.data);
        setLoading(false);
        setError(null);
      })
      .catch(error => {
        console.error('Error fetching roster:', error);
        setError('Failed to load roster data');
        setLoading(false);
      });
  }, [team.id]);
  
  const getSortedRoster = () => {
    return [...roster].sort((a, b) => {
      // First, separate bench from active players
      if (a.roster_status === 'BENCH' && b.roster_status !== 'BENCH') return 1;
      if (a.roster_status !== 'BENCH' && b.roster_status === 'BENCH') return -1;
      
      // Sort by position order
      const valueA = positionOrder[a.position] || 999;
      const valueB = positionOrder[b.position] || 999;
      
      return valueA - valueB;
    });
  };
  
  if (loading) return <div className="team-roster-loading">Loading roster data...</div>;
  if (error) return <div className="team-roster-error">{error}</div>;
  
  // Calculate total home runs for the team
  const totalHomeRuns = roster.reduce((total, player) => {
    return total + (parseInt(player.hr_count) || 0);
  }, 0);
  
  const getStatusBadge = (playerStatus) => {
    if (playerStatus === 'IL') {
      return <span className="status-badge il-badge">IL</span>;
    } else if (playerStatus === 'DTD') {
      return <span className="status-badge dtd-badge">DTD</span>;
    }
    return null;
  };

  // Format player name as F. LastName (drafted pos)
  const formatPlayerName = (fullName, draftedPosition) => {
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastNameParts = nameParts.slice(1);
    return `${firstName[0]}. ${lastNameParts.join(' ')} (${draftedPosition})`;
  };

  // Check if player is eligible to be moved
  const isPlayerEligible = (player) => {
    // Don't allow moves if player's game is live or final today
    if (player.game_status === 'live' || player.game_status === 'final') {
      return false;
    }
    
    // Case 1: Injured starters
    if (player.position !== 'BEN' && player.player_status === 'IL') return true;
    
    // Case 2: Bench-drafted players currently starting  
    if (player.position !== 'BEN' && player.drafted_position === 'BEN') return true;
    
    // Case 3: Any benched player can be activated
    if (player.position === 'BEN') return true;
    
    return false;
  };

  // Handle move button click
  const handleMoveClick = (player) => {
    setSelectedPlayer(player);
    setShowMoveModal(true);
  };

  const userCanManage = canManageTeam(team.id, team.league_id);

  const handleMoveSuccess = () => {
    setShowMoveModal(false);
    setSelectedPlayer(null);
    // Reload roster data
    setLoading(true);
    axios.get(`${process.env.REACT_APP_API_URL}/api/team/${team.id}/roster-with-hrs`)
      .then(response => {
        setRoster(response.data);
        setLoading(false);
        setError(null);
      })
      .catch(error => {
        console.error('Error fetching roster:', error);
        setError('Failed to load roster data');
        setLoading(false);
      });
  };

  return (
    <div className="team-roster">
      <div className="team-roster-header">
        <div className="team-info">
          <h3>{team.name}</h3>
          <div className="team-roster-manager">Manager: {team.manager_name}</div>
          <div className="team-total-hrs">Total Dongs: <span className="hrs-count">{totalHomeRuns}</span></div>
        </div>
      </div>
      
      <div className="roster-table-container">
        <table className="roster-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Player</th>
              <th>Action</th>
              <th>HR</th>
              <th>Today</th>
            </tr>
          </thead>
          <tbody>
            {getSortedRoster().map(player => (
              <tr key={player.player_id} className={player.roster_status === 'BENCH' ? 'bench-player' : ''}>
                <td>{player.position}</td>
                <td>
                  {formatPlayerName(player.name, player.drafted_position)} {getStatusBadge(player.player_status)}
                </td>
                <td>
                  {userCanManage && isPlayerEligible(player) && (
                    <button 
                      className="move-button"
                      onClick={() => handleMoveClick(player)}
                      title={`Move ${formatPlayerName(player.name, player.drafted_position)}`}
                    >
                      MOVE
                    </button>
                  )}
                </td>
                <td>{player.hr_count}</td>
                <td className="game-status">
                  <span className={`game-info game-${player.game_status || 'none'}`}>
                    {player.game_info}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {showMoveModal && selectedPlayer && (
        <PlayerSwapModal
          team={team}
          roster={roster}
          selectedPlayer={selectedPlayer}
          onClose={() => {
            setShowMoveModal(false);
            setSelectedPlayer(null);
          }}
          onSuccess={handleMoveSuccess}
        />
      )}
    </div>
  );
};

export default TeamRoster;