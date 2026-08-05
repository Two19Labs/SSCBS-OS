import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useTimetable } from '../context/TimetableContext';
import { PERIODS, DAYS } from '../data/timetables';
import NoticeBoard from './NoticeBoard';
import { SearchIcon, PercentIcon, CalculatorIcon, FileIcon, TrophyIcon } from './icons';
import { isAdminEmail, canAccessTeamFinder } from '../lib/admin';
import './HomeDashboard.css';


function getISTTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 5.5);
}

const parseTimeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

export default function HomeDashboard({ onNavigate, onOpenProfile }) {
  const { user } = useAuth();
  const { featureFlags } = useConfig();
  const isAdmin = isAdminEmail(user?.email);
  const { getTimetable, holidays } = useTimetable();
  const [time, setTime] = useState(getISTTime());

  // Check if today is a holiday
  const todayStr = time.getFullYear() + '-' + String(time.getMonth() + 1).padStart(2, '0') + '-' + String(time.getDate()).padStart(2, '0');
  const todayHoliday = holidays?.find(h => h.date === todayStr);

  useEffect(() => {
    const interval = setInterval(() => setTime(getISTTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student';
  const firstName = displayName.split(' ')[0];
  const course = user?.user_metadata?.course;
  const semester = user?.user_metadata?.semester;
  const section = user?.user_metadata?.section;
  const hasProfile = course && semester && section;

  const hour = time.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const dayOfWeek = DAYS[time.getDay() - 1] || 'Sunday';
  const isWeekend = dayOfWeek === 'Sunday' || dayOfWeek === 'Saturday';
  const currentMinutes = hour * 60 + time.getMinutes();

  const timetable = hasProfile ? getTimetable(course, semester, section) : null;
  const todayClasses = timetable ? timetable[dayOfWeek] || [] : [];

  let activeClass = null;
  let activePeriod = null;
  let nextClass = null;
  let nextPeriod = null;

  if (timetable && !isWeekend) {
    todayClasses.forEach((cls) => {
      const p = PERIODS.find((x) => x.id === cls.period || (cls.isBreak && x.id === 0));
      if (!p) return;
      const startMin = parseTimeToMinutes(p.start);
      const endMin = parseTimeToMinutes(p.end);
      if (currentMinutes >= startMin && currentMinutes < endMin) {
        activeClass = cls;
        activePeriod = p;
      }
      if (startMin > currentMinutes && (!nextPeriod || startMin < parseTimeToMinutes(nextPeriod.start))) {
        nextClass = cls;
        nextPeriod = p;
      }
    });
  }

  const remaining = () => {
    if (!activePeriod) return '';
    const endSec = parseTimeToMinutes(activePeriod.end) * 60;
    const nowSec = hour * 3600 + time.getMinutes() * 60 + time.getSeconds();
    const diff = Math.max(0, endSec - nowSec);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (h > 0) return `${h}h ${m}m left`;
    if (m > 0) return `${m}m ${s}s left`;
    return `${s}s left`;
  };

  const progress = () => {
    if (!activePeriod) return 0;
    const start = parseTimeToMinutes(activePeriod.start) * 60;
    const end = parseTimeToMinutes(activePeriod.end) * 60;
    const nowSec = hour * 3600 + time.getMinutes() * 60 + time.getSeconds();
    return Math.max(0, Math.min(100, ((nowSec - start) / (end - start)) * 100));
  };

  const isRealClass = activeClass && !activeClass.isBreak && activeClass.subject !== 'Free';

  const renderLiveCard = () => {
    if (!hasProfile) {
      return (
        <div className="home-live-card">
          <span className="micro-label dim">SET UP REQUIRED</span>
          <div className="live-subject">Set up your class</div>
          <div className="live-meta">Pick your course, semester and section to see your live timetable.</div>
          <button className="btn-ink" style={{ marginTop: 12 }} onClick={onOpenProfile}>
            Set up profile
          </button>
        </div>
      );
    }

    const renderLiveDisclaimer = () => (
      <div className="live-card-disclaimer">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>Uses latest schedule sent via college email (NOT real-time tracking; subject to professor changes/cancellation).</span>
      </div>
    );

    if (todayHoliday) {
      return (
        <div className="home-live-card" style={{ borderLeft: '4px solid var(--maroon)' }}>
          <span className="micro-label maroon">● {todayHoliday.type.toUpperCase()}</span>
          <div className="live-subject">{todayHoliday.title}</div>
          <div className="live-meta">{todayHoliday.message || 'No classes scheduled for today.'}</div>
        </div>
      );
    }

    if (isWeekend) {
      return (
        <div className="home-live-card">
          <span className="micro-label dim">WEEKEND</span>
          <div className="live-subject">No classes today</div>
          <div className="live-meta">Relax, catch up on projects, and enjoy your free time.</div>
          {renderLiveDisclaimer()}
        </div>
      );
    }

    if (isRealClass) {
      return (
        <div className="home-live-card">
          <div className="live-topline">
            <span className="micro-label success">● IN CLASS</span>
            <span className="live-countdown">{remaining()}</span>
          </div>
          <div className="live-subject">{activeClass.subject}</div>
          <div className="live-meta">
            {[activeClass.teacher, activeClass.room, `till ${activePeriod.endLabel}`]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="live-progress">
            <div className="live-progress-fill" style={{ width: `${progress()}%` }}></div>
          </div>
          {nextClass && nextPeriod && (
            <div className="live-next-row">
              <span className="live-next-label">
                Next — {nextClass.isBreak ? 'Break' : nextClass.subject}
                {nextClass.room && !nextClass.isBreak ? ` · ${nextClass.room}` : ''}
              </span>
              <span className="live-next-time">{nextPeriod.startLabel}</span>
            </div>
          )}
          {renderLiveDisclaimer()}
        </div>
      );
    }

    if (activeClass && activeClass.isBreak) {
      return (
        <div className="home-live-card">
          <div className="live-topline">
            <span className="micro-label gold">● INFINITY HOUR</span>
            <span className="live-countdown">{remaining()}</span>
          </div>
          <div className="live-subject">Break</div>
          <div className="live-meta">Go to Nescafe or Amul and chill.</div>
          <div className="live-progress">
            <div className="live-progress-fill" style={{ width: `${progress()}%` }}></div>
          </div>
          {nextClass && nextPeriod && (
            <div className="live-next-row">
              <span className="live-next-label">Next — {nextClass.subject}{nextClass.room ? ` · ${nextClass.room}` : ''}</span>
              <span className="live-next-time">{nextPeriod.startLabel}</span>
            </div>
          )}
          {renderLiveDisclaimer()}
        </div>
      );
    }

    if (activeClass && activeClass.subject === 'Free') {
      return (
        <div className="home-live-card">
          <div className="live-topline">
            <span className="micro-label dim">FREE PERIOD</span>
            <span className="live-countdown">{remaining()}</span>
          </div>
          <div className="live-subject">Free block</div>
          <div className="live-meta">No lecture right now — good time for coursework.</div>
          <div className="live-progress">
            <div className="live-progress-fill" style={{ width: `${progress()}%` }}></div>
          </div>
          {nextClass && nextPeriod && (
            <div className="live-next-row">
              <span className="live-next-label">Next — {nextClass.subject}{nextClass.room ? ` · ${nextClass.room}` : ''}</span>
              <span className="live-next-time">{nextPeriod.startLabel}</span>
            </div>
          )}
          {renderLiveDisclaimer()}
        </div>
      );
    }

    if (nextClass && nextPeriod) {
      return (
        <div className="home-live-card">
          <div className="live-topline">
            <span className="micro-label dim">UP NEXT</span>
            <span className="live-countdown">{nextPeriod.startLabel}</span>
          </div>
          <div className="live-subject">{nextClass.isBreak ? 'Break' : nextClass.subject}</div>
          <div className="live-meta">
            {[!nextClass.isBreak && nextClass.teacher, !nextClass.isBreak && nextClass.room]
              .filter(Boolean)
              .join(' · ') || 'Starts soon'}
          </div>
          {renderLiveDisclaimer()}
        </div>
      );
    }

    return (
      <div className="home-live-card">
        <span className="micro-label dim">DONE FOR TODAY</span>
        <div className="live-subject">Classes completed</div>
        <div className="live-meta">All scheduled sessions for today have concluded. Have a great evening!</div>
        {renderLiveDisclaimer()}
      </div>
    );
  };

  const hasTeamFinderAccess = featureFlags['team-finder'] || canAccessTeamFinder(user?.email);

  const tools = [
    ...(hasTeamFinderAccess ? [{ id: 'team-finder', micro: 'NEW', microClass: 'success', title: 'Team Finder & Compete Hub', desc: 'Find teammates & post comp openings', Icon: TrophyIcon, locked: false }] : []),
    { id: 'find-prof', micro: 'SEARCH', microClass: 'success', title: 'Find My Professor', desc: "Who's teaching where, right now", Icon: SearchIcon, locked: !featureFlags['find-prof'] && !isAdmin },
    { id: 'waiver', micro: 'SOON', microClass: 'dim', title: 'Waiver Tool', desc: 'Clear attendance smartly', Icon: PercentIcon, locked: !featureFlags['waiver'] && !isAdmin },
    { id: 'gpa', micro: 'DU', microClass: 'maroon', title: 'GPA Calculator', desc: 'SGPA & CGPA, official schemas', Icon: CalculatorIcon, locked: !featureFlags['gpa'] && !isAdmin },
    { id: 'pyqs', micro: 'SOON', microClass: 'dim', title: 'PYQs & Resources', desc: 'Papers, syllabus, notes', Icon: FileIcon, locked: !featureFlags['pyqs'] && !isAdmin },
  ];

  return (
    <div className="home-dashboard">
      <div className="home-main-col">
        <div className="home-greeting-row">
          <div>
            <h1 className="home-greeting">{greeting}, {firstName}</h1>
            <div className="micro-label dim home-class-label">
              {hasProfile
                ? `${course} · SEM ${semester} · SECTION ${section}`.toUpperCase()
                : 'PROFILE NOT CONFIGURED'}
            </div>
          </div>
          <span className="ist-pill">
            IST {String(hour % 12 || 12).padStart(2, '0')}:{String(time.getMinutes()).padStart(2, '0')}:{String(time.getSeconds()).padStart(2, '0')} {hour >= 12 ? 'PM' : 'AM'}
          </span>
        </div>

        {renderLiveCard()}

        <div className="home-tools-section">
          <div className="home-section-head">
            <span className="home-section-title">Tools</span>
          </div>
          <div className="home-tools-grid">
            {tools.map(({ id, micro, microClass, title, desc, Icon, locked }) => (
              <button
                key={id}
                className={`home-tool-card ${locked ? 'locked' : ''}`}
                onClick={() => !locked && onNavigate(id)}
                disabled={locked}
              >
                <span className={`micro-label ${microClass}`}>{micro}</span>
                <span className="tool-title">{title}</span>
                <span className="tool-desc">{desc}</span>
                {!locked && <span className="tool-launch">Launch →</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="home-buzz-col">
        <NoticeBoard onNavigate={onNavigate} />
      </div>
    </div>
  );
}
