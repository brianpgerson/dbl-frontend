import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './App.css';
import TeamSelector from './components/TeamSelector';
import TeamRoster from './components/TeamRoster';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function App() {
  const [raceData, setRaceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null); // null means show charts

  useEffect(() => {
    // Connect to real backend data
    axios.get(`${process.env.REACT_APP_API_URL}/api/race`)
      .then(response => {
        setRaceData(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching race data:', error);
        setLoading(false);
        // Fall back to mock data on error
        const mockData = generateMockData();
        setRaceData(mockData);
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

  const generateMockData = () => {
    const teams = ['Binger Bongs', 'Dinger Dongs', 'Homer Homies', 'Blast Bros', 'Yard Yarders', 'Fence Swingers', 'Moon Shots', 'Tater Tots'];
    const days = 30; // Mock 30 days of data
    
    let data = [];
    let totals = teams.reduce((acc, team) => ({ ...acc, [team]: 0 }), {});
    
    for (let day = 1; day <= days; day++) {
      const date = new Date(2025, 2, day).toISOString().split('T')[0]; // March 2025
      
      teams.forEach(team => {
        const dailyHRs = Math.floor(Math.random() * 3); // 0-2 HRs per day
        totals[team] += dailyHRs;
        
        data.push({
          team_name: team,
          date,
          daily_hrs: dailyHRs,
          total_hrs: totals[team]
        });
      });
    }
    
    return data;
  };

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
    const fullDates = allDates.slice(0, lastValidDateIndex + 1);
    // Format as M/D without year for display
    const dates = fullDates.map(date => {
      const parts = date.split('-');
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;  
    });
    
    const teams = [...new Set(raceData.map(d => console.log(d) || d.team_name))];
    
    const datasets = teams.map((team, index) => {
      const teamData = raceData.filter(d => d.team_name === team);
      
      // Sort by date for accurate calculations
      teamData.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      let total = 0;
      const cumulativeData = fullDates.map(date => {
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
        label: "-" + team.split("'")[0], // Add spaces before team name for legend spacing
        data: cumulativeData,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '10',
        borderWidth: 3,
        pointRadius: 5,
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
    const teams = [...new Set(raceData.map(d => d.team_name))];
    
    // Get latest totals for each team by summing all daily HRs
    const teamTotals = teams.map(team => {
      const teamData = raceData.filter(d => d.team_name === team);
      const total = teamData.reduce((sum, day) => sum + parseInt(day.daily_hrs), 0);
      return total;
    });
    
    // Sort teams by total HRs descending
    const sortedTeams = [...teams];
    const sortedTotals = [...teamTotals];
    
    // Bubble sort for simplicity
    for (let i = 0; i < sortedTeams.length; i++) {
      for (let j = 0; j < sortedTeams.length - i - 1; j++) {
        if (sortedTotals[j] < sortedTotals[j + 1]) {
          [sortedTotals[j], sortedTotals[j + 1]] = [sortedTotals[j + 1], sortedTotals[j]];
          [sortedTeams[j], sortedTeams[j + 1]] = [sortedTeams[j + 1], sortedTeams[j]];
        }
      }
    }
    
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
      labels: sortedTeams,
      datasets: [{
        label: 'Total Bombs',
        data: sortedTotals,
        backgroundColor: sortedTeams.map((_, index) => colors[index % colors.length]),
        borderColor: '#000',
        borderWidth: 2,
        borderRadius: 0, // pixel-perfect rectangles
        barThickness: 20 // chunky arcade bars
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
          <p style={{ fontSize: '24px' }}>⏳ 8%</p>
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
        <header className="App-header">
          <h1>Dong Bong League</h1>
          <h2>{new Date().getFullYear()} Season</h2>
        </header>
        
        {selectedTeam ? (
          <TeamRoster team={selectedTeam} />
        ) : (
          <>
            <div className="chart-container">
              <h3>Chart Race</h3>
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
                    position: window.innerWidth <= 768 ? 'bottom' : 'bottom',
                    align: 'start',
                    labels: { 
                      font: { family: "'Press Start 2P', cursive", size: window.innerWidth <= 768 ? 7 : 10 },
                      color: '#19b8ff',
                      usePointStyle: true,
                      pointStyle: 'circle',
                      boxWidth: 10,
                      boxHeight: 10,
                      padding: window.innerWidth <= 768 ? 15 : 25,
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
              <h3>Team Totals</h3>
              <Bar data={prepareBarChartData()} options={{
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: window.innerWidth <= 768 ? 1 : 1.5,
                layout: {
                  padding: { bottom: 30 }
                },
                plugins: {
                  legend: { 
                    position: 'top', 
                    labels: { 
                      font: { family: "'Press Start 2P', cursive", size: 10 },
                      color: '#ff3333',
                      padding: 15
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
          </>
        )}
      </div>
    </>
  );
}

export default App;
