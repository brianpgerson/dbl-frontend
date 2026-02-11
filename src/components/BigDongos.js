import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Engine from '../game/Engine';
import { GAME } from '../game/constants';
import { useAuth } from '../contexts/AuthContext';
import './BigDongos.css';

export default function BigDongos() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const { seasonId: paramSeasonId } = useParams();
  const { isAuthenticated } = useAuth();

  const [seasonId, setSeasonId] = useState(paramSeasonId || null);
  const [gameState, setGameState] = useState('idle');
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(GAME.maxAttempts);
  const [resumeSwing, setResumeSwing] = useState(0); // swing to resume from
  const [leaderboard, setLeaderboard] = useState([]);
  const [, setBestDistance] = useState(null);
  const [attemptComplete, setAttemptComplete] = useState(false);

  // Auto-detect season
  useEffect(() => {
    if (paramSeasonId) { setSeasonId(paramSeasonId); return; }
    axios.get(`${process.env.REACT_APP_API_URL}/api/status`)
      .then(res => { if (res.data.season?.id) setSeasonId(res.data.season.id); })
      .catch(err => console.error('Failed to detect season:', err));
  }, [paramSeasonId]);

  // Load data
  const loadData = useCallback(async () => {
    if (!seasonId) return;
    try {
      const requests = [
        axios.get(`${process.env.REACT_APP_API_URL}/api/big-dongos/${seasonId}/leaderboard`),
      ];
      if (isAuthenticated) {
        requests.push(
          axios.get(`${process.env.REACT_APP_API_URL}/api/big-dongos/${seasonId}/my-results`)
        );
      }
      const results = await Promise.all(requests);
      setLeaderboard(results[0].data.leaderboard || []);
      setMaxAttempts(results[0].data.max_attempts || GAME.maxAttempts);

      if (results[1]?.data) {
        const data = results[1].data;
        const used = data.attempts_used || 0;
        const currentSwings = data.current_attempt_swings || 0;
        const totalPerAttempt = data.total_swings_per_attempt || 10;

        setAttemptsUsed(used);

        // Determine resume state
        if (used === 0) {
          // Fresh — no attempts yet
          setAttemptNumber(1);
          setResumeSwing(0);
          setAttemptComplete(false);
        } else if (currentSwings < totalPerAttempt) {
          // Mid-attempt — resume from where they left off
          setAttemptNumber(used);
          setResumeSwing(currentSwings);
          setAttemptComplete(false);
        } else {
          // Last attempt was completed
          setAttemptNumber(used + 1);
          setResumeSwing(0);
          setAttemptComplete(false);
        }
      }
    } catch (err) {
      console.error('Failed to load Big Dongos data:', err);
    }
  }, [seasonId, isAuthenticated]);

  useEffect(() => { loadData(); }, [loadData]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const container = canvas.parentElement;
      const maxW = Math.min(container.clientWidth - 4, 800);
      const maxH = Math.min(window.innerHeight * 0.7, 600);
      const aspect = 4 / 3;
      let cw = maxW, ch = cw / aspect;
      if (ch > maxH) { ch = maxH; cw = ch * aspect; }
      cw = Math.floor(cw); ch = Math.floor(ch);
      canvas.width = cw; canvas.height = ch;
      canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Save a single swing to DB
  const saveSwing = useCallback(async (contact, swingIndex, isWarmup) => {
    if (!isAuthenticated || !seasonId) return;
    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/big-dongos/${seasonId}/swing`,
        {
          attempt_number: attemptNumber,
          swing_number: swingIndex + 1, // 1-indexed
          is_warmup: isWarmup,
          distance_feet: contact.isWhiff ? 0 : contact.distance.feet,
          distance_inches: contact.isWhiff ? 0 : contact.distance.inches,
          exit_velocity: contact.isWhiff ? 0 : contact.exitVelocity,
          launch_angle: contact.isWhiff ? 0 : contact.launchAngle,
          contact_quality: contact.contactQuality || 0,
        }
      );
    } catch (err) {
      console.error('Failed to save swing:', err);
    }
  }, [seasonId, attemptNumber, isAuthenticated]);

  // Start game
  const alreadyPlayed = attemptsUsed >= maxAttempts && resumeSwing === 0;

  const startGame = useCallback((forcePractice) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (engineRef.current) engineRef.current.stop();

    const isPractice = forcePractice || alreadyPlayed;
    const engine = new Engine(canvas);
    engine.practiceMode = isPractice;
    engineRef.current = engine;

    if (!isPractice) {
      // Save each swing as it happens (only for real attempts)
      engine.onSwingComplete = (contact, swingIndex, isWarmup) => {
        saveSwing(contact, swingIndex, isWarmup);
      };

      engine.onAttemptComplete = (results) => {
        setGameState('done');
        setAttemptComplete(true);

        const realResults = results.slice(GAME.warmupSwings);
        let best = null;
        for (const r of realResults) {
          if (!r.isWhiff && (!best || r.distance.totalFeet > best.totalFeet)) {
            best = r.distance;
          }
        }
        setBestDistance(best);
        loadData();
      };
    }

    engine.start();
    if (!isPractice && resumeSwing > 0) {
      engine.startFromSwing(resumeSwing);
    }
    setGameState('playing');
    setBestDistance(null);
  }, [saveSwing, resumeSwing, loadData, alreadyPlayed]);

  useEffect(() => {
    return () => { if (engineRef.current) engineRef.current.stop(); };
  }, []);

  const needsResume = resumeSwing > 0 && !attemptComplete;
  // attemptsUsed < maxAttempts check is handled by alreadyPlayed

  return (
    <div className="big-dongos-container">
      <div className="big-dongos-canvas-wrap">
        <canvas ref={canvasRef} className="big-dongos-canvas" />

        {gameState === 'idle' && (
          <div className="big-dongos-overlay">
            <h2 className="big-dongos-title">BIG DONGOS</h2>
            <p className="big-dongos-subtitle">Draft Order Minigame</p>

            {!isAuthenticated ? (
              <p className="big-dongos-msg">Sign in to play!</p>
            ) : !seasonId ? (
              <p className="big-dongos-msg">No active season found</p>
            ) : alreadyPlayed ? (
              <>
                <button className="big-dongos-btn" onClick={() => startGame(true)}>
                  PRACTICE
                </button>
                <p className="big-dongos-attempts">
                  You've already submitted your score
                </p>
                <p className="big-dongos-attempts" style={{ marginTop: 8 }}>
                  Practice swings won't count
                </p>
              </>
            ) : needsResume ? (
              <>
                <button className="big-dongos-btn" onClick={() => startGame(false)}>
                  RESUME
                </button>
                <p className="big-dongos-attempts">
                  Resuming (swing {resumeSwing + 1}/10)
                </p>
              </>
            ) : (
              <>
                <button className="big-dongos-btn" onClick={() => startGame(false)}>
                  PLAY
                </button>
              </>
            )}
          </div>
        )}

        {/* Done state is rendered entirely on the canvas */}
      </div>

      {/* How to Play */}
      <div className="big-dongos-instructions">
        <h3>How to Play</h3>
        <ol>
          <li>Watch the pitcher wind up and throw</li>
          <li><strong>Swipe sideways</strong> through the ball as it crosses the zone</li>
          <li><strong>Match the height</strong> — your bat path must intersect the ball</li>
          <li><strong>Time it</strong> — swing when the ball is in the zone for max power</li>
        </ol>
        <p className="big-dongos-tip">Early swings pull left, late swings go right!</p>
        <p className="big-dongos-tip">5 warmup swings to get your eye in, then 5 real swings. Best distance counts!</p>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="big-dongos-leaderboard">
          <h3>Leaderboard</h3>
          <table>
            <thead>
              <tr><th>#</th><th>Manager</th><th>Best Dong</th><th>Attempts</th></tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <tr key={entry.user_id} className={i === 0 ? 'big-dongos-leader' : ''}>
                  <td>{entry.rank}</td>
                  <td>{entry.manager_name || entry.email}</td>
                  <td>{entry.best_feet}' {entry.best_inches}"</td>
                  <td>{entry.attempts_used} / {maxAttempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
