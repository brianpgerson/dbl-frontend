import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './App.css';
import TeamSelector from './components/TeamSelector';
import TeamRoster from './components/TeamRoster';
import HomeRunVideos from './components/HomeRunVideos';
import UserIcon from './components/UserIcon';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function App() {
  const [raceData, setRaceData] = useState([]);
  const [seasonYear, setSeasonYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null); // null means show charts
  const [timeInterval, setTimeInterval] = useState('full'); // 'full', 'month', or 'week'
  const [showFromZero, setShowFromZero] = useState(false); // toggle for showing chart from zero

  useEffect(() => {
    // Connect to real backend data
    axios.get(`${process.env.REACT_APP_API_URL}/api/race`)
      .then(response => {
        setRaceData(response.data.data || response.data);
        setSeasonYear(response.data.season_year || new Date().getFullYear());
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching race data:', error);
        setLoadError('Failed to load race data. Please refresh the page.');
        setLoading(false);
      });
  }, []);

  // Fetch teams
  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/teams`)
      .then(response => {
        setTeams(response.data);
      })
      .catch(error => {
        console.error('Error fetching teams:', error);
      });
  }, []);

  const prepareLineChartData = () => {
    const allDates = [...new Set(raceData.map(d => d.date))].sort();
    
    // Find the last date that has any HR data
    let lastValidDateIndex = allDates.length - 1;
    while (lastValidDateIndex > 0) {
      const date = allDates[lastValidDateIndex];
      const hasHRs = raceData.some(d => d.date === date && d.total_hrs > 0);
      if (hasHRs) break;
      lastValidDateIndex--;
    }
    
    // Only show dates up to the last date with actual data
    const lastValidDate = allDates[lastValidDateIndex];
    
    // Filter dates based on selected time interval
    let filteredDates = [];
    if (timeInterval === 'week') {
      // Last 7 days
      const oneWeekAgo = new Date(lastValidDate);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      filteredDates = allDates.filter(date => new Date(date) >= oneWeekAgo && date <= lastValidDate);
    } else if (timeInterval === 'month') {
      // Last 30 days
      const oneMonthAgo = new Date(lastValidDate);
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      filteredDates = allDates.filter(date => new Date(date) >= oneMonthAgo && date <= lastValidDate);
    } else {
      // Full season
      filteredDates = allDates.slice(0, lastValidDateIndex + 1);
    }
    
    // Format as M/D without year for display
    const dates = filteredDates.map(date => {
      const parts = date.split('-');
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;  
    });
    
    const teamNames = [...new Set(raceData.map(d => d.team_name))];
    
    const datasets = teamNames.map((teamName, index) => {
      const teamData = raceData.filter(d => d.team_name === teamName);
      
      // Find the matching team object with manager name
      const teamObj = teams.find(t => t.name === teamName);
      const managerName = teamObj ? teamObj.manager_name : '';
      
      // Sort by date for accurate calculations
      teamData.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Find the cumulative total at the start of our interval (for partial views)
      let startTotal = 0;
      if (timeInterval !== 'full' && filteredDates.length > 0 && !showFromZero) {
        const earliestDate = filteredDates[0];
        const earlierDates = allDates.filter(date => date < earliestDate);
        
        // Calculate HR sum up to the start date
        earlierDates.forEach(date => {
          const entry = teamData.find(d => d.date === date);
          if (entry) {
            startTotal += parseInt(entry.daily_hrs);
          }
        });
      }
      
      let total = startTotal;
      const cumulativeData = filteredDates.map(date => {
        const entry = teamData.find(d => d.date === date);
        if (entry) {
          total += parseInt(entry.daily_hrs);
          return total;
        }
        return null;
      });
      
      // Retro arcade colors - bright neons
      const colors = [
        '#00ff00', // Green (Matrix)
        '#ff00ff', // Magenta
        '#00ffff', // Cyan
        '#ffff00', // Yellow
        '#ff3333', // Red
        '#3333ff', // Blue
        '#ff8800', // Orange
        '#ffffff'  // White
      ];
      
      return {
        label: `${managerName ? `${managerName}'s ` : ' '}${teamName}`,
        data: cumulativeData,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '10',
        borderWidth: 1,
        pointRadius: 2,
        pointStyle: 'circle',
        pointBackgroundColor: colors[index % colors.length],
        tension: 0.1 // very slight curve
      };
    });
    
    return {
      labels: dates,
      datasets
    };
  };

  const prepareBarChartData = () => {
    // Retro arcade colors - bright neons - MUST match the array in prepareLineChartData
    const colors = [
      '#00ff00', // Green (Matrix)
      '#ff00ff', // Magenta
      '#00ffff', // Cyan
      '#ffff00', // Yellow
      '#ff3333', // Red
      '#3333ff', // Blue
      '#ff8800', // Orange
      '#ffffff'  // White
    ];
    
    const teamNames = [...new Set(raceData.map(d => d.team_name))];
    
    // Create a map of team name to color index to maintain consistency with line chart
    const teamColorMap = {};
    teamNames.forEach((teamName, index) => {
      teamColorMap[teamName] = colors[index % colors.length];
    });
    
    // Create team labels with manager names
    const teamLabels = teamNames.map(teamName => {
      const teamObj = teams.find(t => t.name === teamName);
      const managerName = teamObj ? teamObj.manager_name : '';
      return `${managerName ? `${managerName}'s ` : ' '}${teamName}`;
    });
    
    // Get latest totals for each team by summing all daily HRs
    const teamTotals = teamNames.map(teamName => {
      const teamData = raceData.filter(d => d.team_name === teamName);
      const total = teamData.reduce((sum, day) => sum + parseInt(day.daily_hrs), 0);
      return total;
    });
    
    // Get pairs of [label, total, teamName] for sorting
    const teamDataPairs = teamLabels.map((label, index) => [
      label, 
      teamTotals[index],
      teamNames[index]  // Keep original team name for color mapping
    ]);
    
    // Sort teams by total HRs descending
    teamDataPairs.sort((a, b) => b[1] - a[1]);
    
    // Extract sorted labels, totals and team names
    const sortedLabels = teamDataPairs.map(pair => pair[0]);
    const sortedTotals = teamDataPairs.map(pair => pair[1]);
    const sortedTeamNames = teamDataPairs.map(pair => pair[2]);
    
    return {
      labels: sortedLabels,
      datasets: [{
        data: sortedTotals,
        backgroundColor: sortedTeamNames.map(teamName => teamColorMap[teamName]),
        borderColor: '#000',
        borderWidth: 2,
        borderRadius: 0, // pixel-perfect rectangles
        barThickness: 30 // chunky arcade bars
      }]
    };
  };

  if (loading) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Dong Bong League</h1>
        </header>
        <div className="loading">
          <p>LOADING DATA...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Dong Bong League</h1>
        </header>
        <div className="loading">
          <p>{loadError}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}>
            RETRY
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="star-field"></div>
      <div className="scanlines"></div>
      <div className="pink-glow"></div>
      <TeamSelector teams={teams} onSelectTeam={setSelectedTeam} selectedTeam={selectedTeam} />
      <div className="App">
        <UserIcon />
        <header className="App-header">
          <div className="header-content">
            <h1>Dong Bong League</h1>
            <h2>{seasonYear} Season</h2>
          </div>
        </header>
        
        {selectedTeam ? (
          <TeamRoster team={selectedTeam} />
        ) : (
          <>
            <div className="chart-container">
              <div className="chart-header">
                <h3>Chart Race</h3>
                <div className="chart-controls">
                  <div className="time-interval-selector">
                    <button 
                      className={`interval-button ${timeInterval === 'full' ? 'active' : ''}`}
                      onClick={() => setTimeInterval('full')}
                    >
                      Full Season
                    </button>
                    <button 
                      className={`interval-button ${timeInterval === 'month' ? 'active' : ''}`}
                      onClick={() => setTimeInterval('month')}
                    >
                      Last Month
                    </button>
                    <button 
                      className={`interval-button ${timeInterval === 'week' ? 'active' : ''}`}
                      onClick={() => setTimeInterval('week')}
                    >
                      Last Week
                    </button>
                  </div>
                  {timeInterval !== 'full' && (
                    <div className="zero-toggle">
                      <label className="toggle-label">
                        <input 
                          type="checkbox"
                          checked={showFromZero}
                          onChange={(e) => setShowFromZero(e.target.checked)}
                        />
                        Period only
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <Line data={prepareLineChartData()} options={{
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: window.innerWidth <= 768 ? .8 : 1.2,
                layout: {
                  padding: {
                    bottom: 10
                  }
                },
                plugins: {
                  legend: { 
                    position: 'bottom',
                    align: 'start',
                    labels: { 
                      font: { family: "'Press Start 2P', cursive", size: window.innerWidth <= 768 ? 7 : 10 },
                      color: '#19b8ff',
                      usePointStyle: true,
                      pointStyle: 'circle',
                      pointStyleWidth: 4,
                      boxHeight: 3,
                      padding: window.innerWidth <= 768 ? 13 : 25,
                      useBorderRadius: true,
                      borderRadius: 1
                    }
                  }
                },
                scales: {
                  y: { 
                    grid: { color: '#333' },
                    ticks: { color: '#19b8ff' },
                    border: { color: '#19b8ff' } 
                  },
                  x: { 
                    grid: { color: '#333' },
                    ticks: { color: '#19b8ff', maxRotation: 45, minRotation: 45 },
                    border: { color: '#19b8ff' }
                  }
                }
              }} />
            </div>
            
            <div className="chart-container">
              <h3 style={ { marginBottom: 50, textAlign: 'left' } }>Team Dong Counts</h3>
              <Bar data={prepareBarChartData()} options={{
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: window.innerWidth <= 768 ? 1 : 1.5,
                layout: {
                  padding: { bottom: 30 }
                },
                plugins: {
                  legend: { 
                    display: false,
                  }
                },
                scales: {
                  y: { 
                    grid: { color: '#333' },
                    ticks: { color: '#19b8ff' },
                    border: { color: '#19b8ff' }
                  },
                  x: { 
                    grid: { color: '#333' },
                    ticks: { 
                      color: '#19b8ff', 
                      font: { size: window.innerWidth <= 768 ? 10 : 12 },
                      maxRotation: 45, 
                      minRotation: 45
                    },
                    border: { color: '#19b8ff' }
                  }
                }
              }} />
            </div>
            
            <HomeRunVideos />
          </>
        )}
      </div>
    </>
  );
}

export default App;
