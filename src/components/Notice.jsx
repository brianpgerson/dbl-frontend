import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Notice.css';

const DISPLAY_MS = 10000;

// Full-screen notice overlay. Asks the backend for a pending notice for the
// current page (home or a team page) and, if one comes back, shows it until
// the timer elapses. The backend decides whether anything should show.
export default function Notice() {
  const { teamId } = useParams();
  const { isAuthenticated } = useAuth();
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    const params = teamId ? { context: 'team', teamId } : { context: 'home' };
    axios.get(`${process.env.REACT_APP_API_URL}/api/notices/pending`, { params })
      .then(res => { if (!cancelled && res.data?.show) setNotice(res.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, teamId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;

  return (
    <div className="notice-overlay">
      <img className="notice-image" src={notice.image_data} alt="" />
      {notice.caption && <p className="notice-caption">{notice.caption}</p>}
    </div>
  );
}
