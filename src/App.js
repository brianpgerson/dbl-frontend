import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './App.css';
import TeamSelector from './components/TeamSelector';
import TeamRoster from './components/TeamRoster';
import HomeRunVideos from './components/HomeRunVideos';
import UserIcon from './components/UserIcon';
import LeagueHistory from './components/LeagueHistory';
import AdminPortal from './components/AdminPortal';
import { useAuth } from './contexts/AuthContext';
import { useLineChartData, useBarChartData } from './hooks/useChartData';
import { useIsMobile } from './hooks/useWindowWidth';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function AppContent() {
  const [raceData, setRaceData] = useState([]);
  const [seasonYear, setSeasonYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [teams, setTeams] = useState([]);
  const [timeInterval, setTimeInterval] = useState('full');
  const [showFromZero, setShowFromZero] = useState(false);

  const navigate = useNavigate();
  const { teamId } = useParams();
  const { user: authUser } = useAuth();
  const isMobile = useIsMobile();
  const isCommissioner = authUser?.commissionerLeagues?.length > 0;

  const selectedTeam = teamId ? teams.find(t => t.id === parseInt(teamId, 10)) : null;

  useEffect(() => {
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

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/teams`)
      .then(response => {
        setTeams(response.data);
      })
      .catch(error => {
        console.error('Error fetching teams:', error);
      });
  }, []);

  const lineChartData = useLineChartData(raceData, teams, timeInterval, showFromZero);
  const barChartData = useBarChartData(raceData, teams);

  const handleSelectTeam = (team) => {
    if (team) {
      navigate(`/team/${team.id}`);
    } else {
      navigate('/');
    }
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
      <TeamSelector teams={teams} onSelectTeam={handleSelectTeam} selectedTeam={selectedTeam} />
      <div className="App">
        <UserIcon />
        <header className="App-header">
          <div className="header-content">
            <h1>Dong Bong League</h1>
            <h2>{seasonYear} Season</h2>
            <nav className="header-nav">
              <span className="nav-active">Current Season</span>
              <a href="/history">History</a>
              {isCommissioner && <a href="/admin">Admin</a>}
            </nav>
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
              <Line data={lineChartData} options={{
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: isMobile ? 0.8 : 1.2,
                layout: { padding: { bottom: 10 } },
                plugins: {
                  legend: {
                    position: 'bottom',
                    align: 'start',
                    labels: {
                      font: { family: "'Press Start 2P', cursive", size: isMobile ? 7 : 10 },
                      color: '#19b8ff',
                      usePointStyle: true,
                      pointStyle: 'circle',
                      pointStyleWidth: 4,
                      boxHeight: 3,
                      padding: isMobile ? 13 : 25,
                      useBorderRadius: true,
                      borderRadius: 1
                    }
                  }
                },
                scales: {
                  y: { grid: { color: '#333' }, ticks: { color: '#19b8ff' }, border: { color: '#19b8ff' } },
                  x: { grid: { color: '#333' }, ticks: { color: '#19b8ff', maxRotation: 45, minRotation: 45 }, border: { color: '#19b8ff' } }
                }
              }} />
            </div>

            <div className="chart-container">
              <h3 style={{ marginBottom: 50, textAlign: 'left' }}>Team Dong Counts</h3>
              <Bar data={barChartData} options={{
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: isMobile ? 1 : 1.5,
                layout: { padding: { bottom: 30 } },
                plugins: { legend: { display: false } },
                scales: {
                  y: { grid: { color: '#333' }, ticks: { color: '#19b8ff' }, border: { color: '#19b8ff' } },
                  x: {
                    grid: { color: '#333' },
                    ticks: { color: '#19b8ff', font: { size: isMobile ? 10 : 12 }, maxRotation: 45, minRotation: 45 },
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

function HistoryPage() {
  return (
    <>
      <div className="star-field"></div>
      <div className="scanlines"></div>
      <div className="pink-glow"></div>
      <div className="App">
        <UserIcon />
        <header className="App-header">
          <div className="header-content">
            <h1>Dong Bong League</h1>
            <nav className="header-nav">
              <a href="/">Current Season</a>
              <span className="nav-active">History</span>
            </nav>
          </div>
        </header>
        <LeagueHistory />
      </div>
    </>
  );
}

function AdminPage() {
  return (
    <>
      <div className="star-field"></div>
      <div className="scanlines"></div>
      <div className="pink-glow"></div>
      <div className="App">
        <UserIcon />
        <header className="App-header">
          <div className="header-content">
            <h1>Dong Bong League</h1>
            <nav className="header-nav">
              <a href="/">Current Season</a>
              <a href="/history">History</a>
              <span className="nav-active">Admin</span>
            </nav>
          </div>
        </header>
        <AdminPortal />
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/team/:teamId" element={<AppContent />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
