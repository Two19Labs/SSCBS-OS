import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTimetable } from '../context/TimetableContext';
import { PERIODS, DAYS } from '../data/timetables';
import NoticeBoard from './NoticeBoard';
import { SearchIcon, PercentIcon, CalculatorIcon, FileIcon } from './icons';
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
  const { getTimetable } = useTimetable();
  const [time, setTime] = useState(getISTTime());

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

    if (isWeekend) {
      return (
        <div className="home-live-card">
          <span className="micro-label dim">WEEKEND</span>
          <div className="live-subject">No classes today</div>
          <div className="live-meta">Relax, catch up on projects, and enjoy your free time.</div>
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
        </div>
      );
    }

    return (
      <div className="home-live-card">
        <span className="micro-label dim">DONE FOR TODAY</span>
        <div className="live-subject">Classes completed</div>
        <div className="live-meta">All scheduled sessions for today have concluded. Have a great evening!</div>
      </div>
    );
  };

  const tools = [
    { id: 'find-prof', micro: 'LIVE', microClass: 'success', title: 'Find My Professor', desc: "Who's teaching where, right now", Icon: SearchIcon },
    { id: 'waiver', micro: '85%', microClass: 'gold', title: 'Waiver Tool', desc: 'Clear attendance smartly', Icon: PercentIcon },
    { id: 'gpa', micro: 'DU', microClass: 'maroon', title: 'GPA Calculator', desc: 'SGPA & CGPA, official schemas', Icon: CalculatorIcon },
    { id: 'pyqs', micro: 'SOON', microClass: 'dim', title: 'PYQs & Resources', desc: 'Papers, syllabus, notes', Icon: FileIcon, locked: true },
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

        <div className="home-buzz-mobile">
          <div className="home-section-head">
            <span className="home-section-title">Campus buzz</span>
            <button className="link-accent" onClick={() => onNavigate('buzz')}>All →</button>
          </div>
        </div>
      </div>

      <div className="home-buzz-col">
        <NoticeBoard />
        <div className="footer-credit">Made with ♥ by Two19 Labs</div>
      </div>
    </div>
  );
}
