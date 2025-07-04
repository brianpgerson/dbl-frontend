import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from './LoginModal';
import '../PlayerSwapModal.css';

const PlayerSwapModal = ({ team, roster, onClose, onSuccess }) => {
  const { isAuthenticated } = useAuth();
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [reason, setReason] = useState('');
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

    if (!player1Id || !player2Id) {
      setError('Please select both players to swap');
      return;
    }

    if (player1Id === player2Id) {
      setError('Please select two different players');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const swapData = {
        teamId: team.id,
        player1Id: parseInt(player1Id),
        player2Id: parseInt(player2Id)
      };

      if (reason.trim()) {
        swapData.reason = reason.trim();
      }

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
    const statusBadge = player.player_status === 'IL' ? ' [IL]' : 
                       player.player_status === 'DTD' ? ' [DTD]' : '';
    return `${player.name} (${player.position})${statusBadge}`;
  };

  // Sort players by position for easier selection
  const sortedRoster = [...roster].sort((a, b) => {
    if (a.position === 'BEN' && b.position !== 'BEN') return 1;
    if (a.position !== 'BEN' && b.position === 'BEN') return -1;
    return a.position.localeCompare(b.position);
  });

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
              <label htmlFor="player1">PLAYER 1</label>
              <select
                id="player1"
                value={player1Id}
                onChange={(e) => setPlayer1Id(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Select Player 1</option>
                {sortedRoster.map(player => (
                  <option key={player.player_id} value={player.player_id}>
                    {getPlayerDisplay(player)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="swap-arrow">⇄</div>
            
            <div className="form-group">
              <label htmlFor="player2">PLAYER 2</label>
              <select
                id="player2"
                value={player2Id}
                onChange={(e) => setPlayer2Id(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Select Player 2</option>
                {sortedRoster.map(player => (
                  <option key={player.player_id} value={player.player_id}>
                    {getPlayerDisplay(player)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="reason">REASON (Optional)</label>
              <input
                type="text"
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Injury"
                disabled={loading}
                maxLength={50}
              />
            </div>
            
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
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              className="swap-button"
              disabled={loading || !player1Id || !player2Id}
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