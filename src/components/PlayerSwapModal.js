import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from './LoginModal';
import '../PlayerSwapModal.css';

const PlayerSwapModal = ({ team, roster, onClose, onSuccess }) => {
  const { isAuthenticated, user } = useAuth();
  const [benchPlayerId, setBenchPlayerId] = useState('');
  const [activatePlayerId, setActivatePlayerId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    if (!benchPlayerId || !activatePlayerId) {
      setError('Please select both a player to bench and a player to activate');
      return;
    }

    if (benchPlayerId === activatePlayerId) {
      setError('Please select two different players');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const swapData = {
        teamId: team.id,
        player1Id: parseInt(benchPlayerId),
        player2Id: parseInt(activatePlayerId)
      };


      if (effectiveDate) {
        swapData.effectiveDate = effectiveDate;
      }

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/roster/swap`,
        swapData
      );

      if (response.data.success) {
        onSuccess();
        // Show success message briefly
        setError(''); // Clear any existing errors
      }
    } catch (error) {
      console.error('Swap error:', error);
      setError(error.response?.data?.error || 'Failed to swap players');
    } finally {
      setLoading(false);
    }
  };

  const getPlayerDisplay = (player) => {
    // Format name as F. LastName (handles multi-part last names)
    const nameParts = player.name.trim().split(' ');
    const firstName = nameParts[0];
    const lastNameParts = nameParts.slice(1);
    const formattedName = `${firstName[0]}. ${lastNameParts.join(' ')}`;
    
    const statusBadge = player.player_status === 'IL' ? ' [IL]' : 
                       player.player_status === 'DTD' ? ' [DTD]' : '';
    return `${formattedName} (${player.position})${statusBadge}`;
  };

  // Get players eligible to be benched
  const getEligibleToBench = () => {
    return roster.filter(player => {
      // Must be currently starting (not on bench)
      if (player.position === 'BEN') return false;
      
      // Case 1: Injured starters
      if (player.player_status === 'IL') return true;
      
      // Case 2: Bench-drafted players currently starting
      if (player.drafted_position === 'BEN') return true;
      
      return false;
    });
  };

  // Get players eligible to be activated
  const getEligibleToActivate = (benchingPlayer = null) => {
    return roster.filter(player => {
      // Must be currently benched
      if (player.position !== 'BEN') return false;
      
      // If no player selected to bench yet, show all benched players
      if (!benchingPlayer) return true;
      
      // Case 1: Bench-drafted players can replace anyone
      if (player.drafted_position === 'BEN') return true;
      
      // Case 2: Position-drafted players can only replace players at their drafted position
      if (player.drafted_position === benchingPlayer.position) return true;
      
      return false;
    });
  };

  // Get the selected bench player for filtering activate dropdown
  const selectedBenchPlayer = roster.find(p => p.player_id === parseInt(benchPlayerId));


  // Check if user is commissioner (has commissionerLeagues)
  const isCommissioner = user?.commissionerLeagues?.length > 0;

  return (
    <>
      <div className="swap-modal-overlay">
        <div className="swap-modal">
          <div className="swap-modal-header">
            <h2>SWAP PLAYERS</h2>
            <button 
              className="close-button"
              onClick={onClose}
              disabled={loading}
            >
              ×
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="swap-form">
            <div className="form-group">
              <label htmlFor="benchPlayer">BENCH THIS PLAYER</label>
              <select
                id="benchPlayer"
                value={benchPlayerId}
                onChange={(e) => {
                  setBenchPlayerId(e.target.value);
                  // Reset activate selection when bench selection changes
                  setActivatePlayerId('');
                }}
                required
                disabled={loading}
                title="Select an injured starter or bench-drafted player currently starting"
              >
                <option value="">Select player to bench</option>
                {getEligibleToBench().map(player => (
                  <option key={player.player_id} value={player.player_id}>
                    {getPlayerDisplay(player)} {player.player_status === 'IL' ? '[Injured]' : '[Bench-drafted utility]'}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="swap-arrow">⬇⬆</div>
            
            <div className="form-group">
              <label htmlFor="activatePlayer">ACTIVATE THIS PLAYER</label>
              <select
                id="activatePlayer"
                value={activatePlayerId}
                onChange={(e) => setActivatePlayerId(e.target.value)}
                required
                disabled={loading || !benchPlayerId}
                title="Select a benched player to activate"
              >
                <option value="">
                  {benchPlayerId ? 'Select player to activate' : 'First select a player to bench'}
                </option>
                {getEligibleToActivate(selectedBenchPlayer).map(player => (
                  <option key={player.player_id} value={player.player_id}>
                    {getPlayerDisplay(player)} {player.drafted_position === 'BEN' ? '[Can play any position]' : `[Can only play ${player.drafted_position}]`}
                  </option>
                ))}
              </select>
            </div>
            
            
            {isCommissioner && (
              <div className="form-group">
                <label htmlFor="effectiveDate">EFFECTIVE DATE (Optional)</label>
                <input
                  type="date"
                  id="effectiveDate"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  disabled={loading}
                />
                <div className="date-help">Leave blank for automatic date calculation</div>
              </div>
            )}
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              className="swap-button"
              disabled={loading || !benchPlayerId || !activatePlayerId}
            >
              {loading ? 'SWAPPING...' : 'EXECUTE SWAP'}
            </button>
          </form>
        </div>
      </div>
      
      {showLoginModal && (
        <LoginModal 
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setShowLoginModal(false);
            // Retry the swap after successful login
            handleSubmit(new Event('submit'));
          }}
        />
      )}
    </>
  );
};

export default PlayerSwapModal;