import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from './LoginModal';
import './PlayerSwapModal.css';

const PlayerSwapModal = ({ team, roster, selectedPlayer, onClose, onSuccess }) => {
  const { isAuthenticated, user } = useAuth();
  const [destinationPlayerId, setDestinationPlayerId] = useState('');
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

    if (!destinationPlayerId) {
      setError('Please select a destination for the move');
      return;
    }

    if (destinationPlayerId === selectedPlayer.player_id.toString()) {
      setError('Player cannot move to themselves');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const swapData = {
        teamId: team.id,
        player1Id: selectedPlayer.player_id,
        player2Id: parseInt(destinationPlayerId)
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

  // Get valid destination players for the selected player
  const getValidDestinations = () => {
    if (!selectedPlayer) return [];

    // If selected player is currently starting
    if (selectedPlayer.position !== 'BEN') {
      return roster.filter(player => 
        (player.position === 'BEN') &&  (player.player_id !== selectedPlayer.player_id) && 
        (['BEN', selectedPlayer.position].includes(player.drafted_position)) &&
        (player.game_status !== 'live' && player.game_status !== 'final')
      );
    } else {
      // Selected player is on bench - can move to starting positions
      return roster.filter(player => (player.position !== 'BEN') && 
        (player.player_id !== selectedPlayer.player_id) &&
        (player.game_status !== 'live' && player.game_status !== 'final') &&
        (selectedPlayer.drafted_position === 'BEN' || selectedPlayer.drafted_position === player.position)
      );
    }
  };

  // Get description of what the move will do
  const getMoveDescription = () => {
    if (!selectedPlayer) return '';
    
    if (selectedPlayer.position !== 'BEN') {
      return `Move ${getPlayerDisplay(selectedPlayer)} to bench`;
    } else {
      return `Activate ${getPlayerDisplay(selectedPlayer)}`;
    }
  };


  // Check if user is commissioner (has commissionerLeagues)
  const isCommissioner = user?.commissionerLeagues?.length > 0;

  return (
    <>
      <div className="swap-modal-overlay">
        <div className="swap-modal">
          <div className="swap-modal-header">
            <h2>MOVE PLAYER</h2>
            <button 
              className="close-button"
              onClick={onClose}
              disabled={loading}
            >
              ×
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="swap-form">
            <div className="move-description">
              {getMoveDescription()}
            </div>
            
            <div className="form-group">
              <label htmlFor="destination">
                {selectedPlayer?.position !== 'BEN' ? 'SWAP WITH BENCH PLAYER' : 'REPLACE STARTER'}
              </label>
              <select
                id="destination"
                value={destinationPlayerId}
                onChange={(e) => setDestinationPlayerId(e.target.value)}
                required
                disabled={loading}
                title="Select player to swap positions with"
              >
                <option value="">
                  {selectedPlayer?.position !== 'BEN' ? 'Select bench player' : 'Select starter to replace'}
                </option>
                {getValidDestinations().map(player => (
                  <option key={player.player_id} value={player.player_id}>
                    {getPlayerDisplay(player)}
                    {selectedPlayer?.position !== 'BEN' 
                      ? (player.drafted_position === 'BEN' ? ' [Can play any position]' : ` [Drafted ${player.drafted_position}]`)
                      : (player.player_status === 'IL' ? ' [Injured]' : ' [Active]')
                    }
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
              disabled={loading || !destinationPlayerId}
            >
              {loading ? 'MOVING...' : 'EXECUTE MOVE'}
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