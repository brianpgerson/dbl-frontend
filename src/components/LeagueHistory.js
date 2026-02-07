import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LeagueHistory.css';

const LeagueHistory = () => {
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/leagues`)
      .then(response => {
        setLeagues(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching leagues:', error);
        setLoading(false);
      });
  }, []);

  const loadStandings = async (leagueId) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/leagues/${leagueId}/standings`);
      setStandings(response.data);
      setSelectedLeague(leagueId);
    } catch (error) {
      console.error('Error fetching standings:', error);
    }
  };

  if (loading) {
    return <div className="league-history-loading">Loading league history...</div>;
  }

  if (leagues.length === 0) {
    return <div className="league-history-empty">No league history available yet.</div>;
  }

  return (
    <div className="league-history">
      <h2>League History</h2>

      <div className="season-list">
        {leagues.map(league => (
          <button
            key={league.id}
            className={`season-button ${selectedLeague === league.id ? 'active' : ''}`}
            onClick={() => loadStandings(league.id)}
          >
            {league.season_year} Season
          </button>
        ))}
      </div>

      {standings && (
        <div className="standings-container">
          <h3>{standings.league.season_year} Final Standings</h3>
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
