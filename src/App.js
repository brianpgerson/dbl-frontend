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
import DraftBoard from './components/DraftBoard';
import BigDongos from './components/BigDongos';
import { useAuth } from './contexts/AuthContext';
import { useLineChartData, useBarChartData } from './hooks/useChartData';
import { useIsMobile } from './hooks/useWindowWidth';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

// Shared page shell with background effects, header, and nav
function PageShell({ children, subtitle, activeNav }) {
  const { user: authUser } = useAuth();
  const isCommissioner = authUser?.commissionerLeagueIds?.length > 0;

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
            {subtitle && <h2>{subtitle}</h2>}
            <nav className="header-nav">
              {activeNav === 'home' ? <span className="nav-active">Home</span> : <a href="/">Home</a>}
              {activeNav === 'history' ? <span className="nav-active">History</span> : <a href="/history">History</a>}
              {activeNav === 'big-dongos' ? <span className="nav-active">Big Dongos</span> : <a href="/big-dongos">Big Dongos</a>}
              {isCommissioner && (activeNav === 'admin' ? <span className="nav-active">Admin</span> : <a href="/admin">Admin</a>)}
            </nav>
          </div>
        </header>
        {children}
      </div>
    </>
  );
}

function AppContent() {
  const [appState, setAppState] = useState(null); // offseason, preseason, drafting, season
  const [statusData, setStatusData] = useState(null);
  const [raceData, setRaceData] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [timeInterval, setTimeInterval] = useState('full');
  const [showFromZero, setShowFromZero] = useState(false);

  const navigate = useNavigate();
  const { teamId } = useParams();
  const isMobile = useIsMobile();

  const selectedTeam = teamId ? teams.find(t => t.id === parseInt(teamId, 10)) : null;

  // Load app status first, then load data based on state
  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/status`)
      .then(response => {
        setStatusData(response.data);
        setAppState(response.data.state);

        // Only fetch race data if we're in season or offseason
        if (response.data.state === 'season' || response.data.state === 'offseason') {
          return axios.get(`${process.env.REACT_APP_API_URL}/api/race`)
            .then(raceRes => {
              setRaceData(raceRes.data.data || raceRes.data);
            });
        }
      })
      .then(() => {
        return axios.get(`${process.env.REACT_APP_API_URL}/api/teams`);
      })
      .then(teamsRes => {
        if (teamsRes) setTeams(teamsRes.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading app data:', error);
        setLoadError('Failed to load data. Please refresh.');
        setLoading(false);
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
      <PageShell>
        <div className="loading"><p>LOADING DATA...</p></div>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell>
        <div className="loading">
          <p>{loadError}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}>RETRY</button>
        </div>
      </PageShell>
    );
  }

  const seasonYear = statusData?.season?.season_year;

  // ---- OFFSEASON ----
  if (appState === 'offseason') {
    return (
      <PageShell subtitle={`Last Season (${seasonYear})`} activeNav="home">
        <TeamSelector teams={teams} onSelectTeam={handleSelectTeam} selectedTeam={selectedTeam} />
        {selectedTeam ? (
          <TeamRoster team={selectedTeam} />
        ) : (
          <>
            <div className="state-banner state-offseason">
              <h3>Offseason</h3>
              <p>The {seasonYear} season has ended. Check out the final results below!</p>
            </div>
            <RaceCharts
              lineChartData={lineChartData} barChartData={barChartData}
              timeInterval={timeInterval} setTimeInterval={setTimeInterval}
              showFromZero={showFromZero} setShowFromZero={setShowFromZero}
              isMobile={isMobile}
            />
          </>
        )}
      </PageShell>
    );
  }

  // ---- PRESEASON ----
  if (appState === 'preseason') {
    return (
      <PageShell subtitle={`${seasonYear} Season`} activeNav="home">
        <div className="state-banner state-preseason">
          <h3>{seasonYear} Season Starting Soon!</h3>
          <p>The draft hasn't started yet. Stay tuned!</p>
        </div>
      </PageShell>
    );
  }

  // ---- DRAFTING ----
  if (appState === 'drafting') {
    return (
      <PageShell subtitle={`${seasonYear} Season`} activeNav="home">
        <div className="draft-live-banner">
          <h3>The Draft Is Live!</h3>
          <a href={`/draft/${statusData.season.id}`} className="draft-live-link">Go to Draft Board</a>
        </div>
      </PageShell>
    );
  }

  // ---- SEASON (midseason) ----
  return (
    <PageShell subtitle={`${seasonYear} Season`} activeNav="home">
      <TeamSelector teams={teams} onSelectTeam={handleSelectTeam} selectedTeam={selectedTeam} />
      {selectedTeam ? (
        <TeamRoster team={selectedTeam} />
      ) : (
        <>
          <RaceCharts
            lineChartData={lineChartData} barChartData={barChartData}
            timeInterval={timeInterval} setTimeInterval={setTimeInterval}
            showFromZero={showFromZero} setShowFromZero={setShowFromZero}
            isMobile={isMobile}
          />
          <HomeRunVideos />
        </>
      )}
    </PageShell>
  );
}

// Extracted chart section to avoid duplication between season and offseason
function RaceCharts({ lineChartData, barChartData, timeInterval, setTimeInterval, showFromZero, setShowFromZero, isMobile }) {
  return (
    <>
      <div className="chart-container">
        <div className="chart-header">
          <h3>Chart Race</h3>
          <div className="chart-controls">
            <div className="time-interval-selector">
              <button className={`interval-button ${timeInterval === 'full' ? 'active' : ''}`} onClick={() => setTimeInterval('full')}>Full Season</button>
              <button className={`interval-button ${timeInterval === 'month' ? 'active' : ''}`} onClick={() => setTimeInterval('month')}>Last Month</button>
              <button className={`interval-button ${timeInterval === 'week' ? 'active' : ''}`} onClick={() => setTimeInterval('week')}>Last Week</button>
            </div>
            {timeInterval !== 'full' && (
              <div className="zero-toggle">
                <label className="toggle-label">
                  <input type="checkbox" checked={showFromZero} onChange={(e) => setShowFromZero(e.target.checked)} />
                  Period only
                </label>
              </div>
            )}
          </div>
        </div>
        <Line data={lineChartData} options={{
          responsive: true, maintainAspectRatio: true, aspectRatio: isMobile ? 0.8 : 1.2,
          layout: { padding: { bottom: 10 } },
          plugins: { legend: { position: 'bottom', align: 'start', labels: {
            font: { family: "'Press Start 2P', cursive", size: isMobile ? 7 : 10 },
            color: '#19b8ff', usePointStyle: true, pointStyle: 'circle', pointStyleWidth: 4,
            boxHeight: 3, padding: isMobile ? 13 : 25, useBorderRadius: true, borderRadius: 1
          }}},
          scales: {
            y: { grid: { color: '#333' }, ticks: { color: '#19b8ff' }, border: { color: '#19b8ff' } },
            x: { grid: { color: '#333' }, ticks: { color: '#19b8ff', maxRotation: 45, minRotation: 45 }, border: { color: '#19b8ff' } }
          }
        }} />
      </div>
      <div className="chart-container">
        <h3 style={{ marginBottom: 50, textAlign: 'left' }}>Team Dong Counts</h3>
        <Bar data={barChartData} options={{
          responsive: true, maintainAspectRatio: true, aspectRatio: isMobile ? 1 : 1.5,
          layout: { padding: { bottom: 30 } },
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: '#333' }, ticks: { color: '#19b8ff' }, border: { color: '#19b8ff' } },
            x: { grid: { color: '#333' }, ticks: { color: '#19b8ff', font: { size: isMobile ? 10 : 12 }, maxRotation: 45, minRotation: 45 }, border: { color: '#19b8ff' } }
          }
        }} />
      </div>
    </>
  );
}

function HistoryPage() {
  return (
    <PageShell activeNav="history">
      <LeagueHistory />
    </PageShell>
  );
}

function AdminPage() {
  return (
    <PageShell activeNav="admin">
      <AdminPortal />
    </PageShell>
  );
}

function BigDongosPage() {
  return (
    <PageShell subtitle="Big Dongos" activeNav="big-dongos">
      <BigDongos />
    </PageShell>
  );
}

function DraftPage() {
  const { seasonId } = useParams();
  return (
    <PageShell subtitle="Draft" activeNav="draft">
      <DraftBoard seasonId={seasonId} />
    </PageShell>
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
        <Route path="/big-dongos" element={<BigDongosPage />} />
        <Route path="/big-dongos/:seasonId" element={<BigDongosPage />} />
        <Route path="/draft/:seasonId" element={<DraftPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
