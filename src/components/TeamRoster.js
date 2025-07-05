import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import PlayerSwapModal from './PlayerSwapModal';
import '../TeamRoster.css';

const TeamRoster = ({ team, canEdit = false }) => {
  const { canManageTeam } = useAuth();
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('position');
  const [sortDirection, setSortDirection] = useState('asc');
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
  
  const handleSort = (field) => {
    // If clicking the same field, toggle direction
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, set it with default ascending order
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const getSortedRoster = () => {
    return [...roster].sort((a, b) => {
      // First, separate bench from active players
      if (a.roster_status === 'BENCH' && b.roster_status !== 'BENCH') return 1;
      if (a.roster_status !== 'BENCH' && b.roster_status === 'BENCH') return -1;
      
      // If both are bench or both are active, sort by the selected field
      let valueA, valueB;
      
      // Handle different field types
      if (sortField === 'position') {
        // Use positionOrder for position sorting
        valueA = positionOrder[a.position] || 999; // Default high number for unknown positions
        valueB = positionOrder[b.position] || 999;
      } else if (sortField === 'hr_count') {
        valueA = parseInt(a[sortField] || 0);
        valueB = parseInt(b[sortField] || 0);
      } else {
        valueA = a[sortField] || '';
        valueB = b[sortField] || '';
        
        // Case insensitive string comparison
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          valueA = valueA.toLowerCase();
          valueB = valueB.toLowerCase();
        }
      }
      
      // Determine sort order
      if (valueA === valueB) return 0;
      
      const comparison = valueA > valueB ? 1 : -1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };
  
  // Get the current sort icon
  const getSortIcon = (field) => {
    if (field !== sortField) return '⇅';
    return sortDirection === 'asc' ? '↑' : '↓';
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

  // Format player name as F. LastName
  const formatPlayerName = (fullName) => {
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastNameParts = nameParts.slice(1);
    return `${firstName[0]}. ${lastNameParts.join(' ')}`;
  };

  // Check if player is eligible to be moved
  const isPlayerEligible = (player) => {
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
              <th onClick={() => handleSort('name')} className="sortable-header">
                Player {getSortIcon('name')}
              </th>
              <th onClick={() => handleSort('position')} className="sortable-header">
                Pos {getSortIcon('position')}
              </th>
              <th>Action</th>
              <th onClick={() => handleSort('hr_count')} className="sortable-header">
                HR {getSortIcon('hr_count')}
              </th>
              <th>Today</th>
            </tr>
          </thead>
          <tbody>
            {getSortedRoster().map(player => (
              <tr key={player.player_id} className={player.roster_status === 'BENCH' ? 'bench-player' : ''}>
                <td>
                  {formatPlayerName(player.name)} {getStatusBadge(player.player_status)}
                </td>
                <td>{player.position}</td>
                <td>
                  {userCanManage && isPlayerEligible(player) && (
                    <button 
                      className="move-button"
                      onClick={() => handleMoveClick(player)}
                      title={`Move ${formatPlayerName(player.name)}`}
                    >
                      MOVE
                    </button>
                  )}
                </td>
                <td>{player.hr_count}</td>
                <td className="game-status">
                  <span className="game-placeholder">@LAD 7:10</span>
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