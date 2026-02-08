import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LeagueHistory.css';

const LeagueHistory = () => {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/leagues/seasons`)
      .then(response => {
        setSeasons(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching seasons:', error);
        setLoading(false);
      });
  }, []);

  const loadStandings = async (seasonId) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/leagues/seasons/${seasonId}/standings`);
      setStandings(response.data);
      setSelectedSeason(seasonId);
    } catch (error) {
      console.error('Error fetching standings:', error);
    }
  };

  if (loading) {
    return <div className="league-history-loading">Loading league history...</div>;
  }

  if (seasons.length === 0) {
    return <div className="league-history-empty">No league history available yet.</div>;
  }

  return (
    <div className="league-history">
      <h2>League History</h2>

      <div className="season-list">
        {seasons.map(season => (
          <button
            key={season.id}
            className={`season-button ${selectedSeason === season.id ? 'active' : ''}`}
            onClick={() => loadStandings(season.id)}
          >
            {season.season_year} Season
          </button>
        ))}
      </div>

      {standings && (
        <div className="standings-container">
          <h3>{standings.season.season_year} Final Standings</h3>
          <table className="standings-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Manager</th>
                <th>Total HRs</th>
              </tr>
            </thead>
            <tbody>
              {standings.standings.map((team, index) => (
                <tr key={team.team_id} className={index === 0 ? 'champion' : ''}>
                  <td>{index + 1}</td>
                  <td>{team.team_name}</td>
                  <td>{team.manager_name}</td>
                  <td className="hr-count">{team.total_hrs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeagueHistory;
