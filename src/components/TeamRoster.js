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
  const [showSwapModal, setShowSwapModal] = useState(false);
  
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
      
      // Handle numeric fields differently
      if (sortField === 'hr_count') {
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

  const userCanManage = canManageTeam(team.id, team.league_id);

  const handleSwapSuccess = () => {
    setShowSwapModal(false);
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
        {userCanManage && (
          <button 
            className="swap-players-button"
            onClick={() => setShowSwapModal(true)}
          >
            SWAP PLAYERS
          </button>
        )}
      </div>
      
      <table className="roster-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('name')} className="sortable-header">
              Player {getSortIcon('name')}
            </th>
            <th onClick={() => handleSort('position')} className="sortable-header">
              Position {getSortIcon('position')}
            </th>
            <th onClick={() => handleSort('hr_count')} className="sortable-header">
              HR {getSortIcon('hr_count')}
            </th>
          </tr>
        </thead>
        <tbody>
          {getSortedRoster().map(player => (
            <tr key={player.player_id} className={player.roster_status === 'BENCH' ? 'bench-player' : ''}>
              <td>
                {player.name} {getStatusBadge(player.player_status)}
              </td>
              <td>{player.position}</td>
              <td>{player.hr_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {showSwapModal && (
        <PlayerSwapModal
          team={team}
          roster={roster}
          onClose={() => setShowSwapModal(false)}
          onSuccess={handleSwapSuccess}
        />
      )}
    </div>
  );
};

export default TeamRoster;