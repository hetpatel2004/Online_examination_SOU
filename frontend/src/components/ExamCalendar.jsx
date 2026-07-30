import { useState, useEffect } from 'react';
import API from '../api/axios';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const SUBJECT_COLORS = {};

function getSubjectColor(name) {
  if (!SUBJECT_COLORS[name]) {
    const hues = [120, 45, 200, 340, 80, 260, 15, 170, 300, 30];
    const idx = Object.keys(SUBJECT_COLORS).length % hues.length;
    SUBJECT_COLORS[name] = `hsla(${hues[idx]}, 65%, 45%, 0.85)`;
  }
  return SUBJECT_COLORS[name];
}

const ExamCalendar = ({ exams, onReschedule }) => {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [draggedExam, setDraggedExam] = useState(null);
  const [viewMode, setViewMode] = useState('month');

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();

  const monthExams = (exams || []).filter(exam => {
    const d = new Date(exam.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const examsByDate = {};
  monthExams.forEach(exam => {
    const day = new Date(exam.date).getDate();
    if (!examsByDate[day]) examsByDate[day] = [];
    examsByDate[day].push(exam);
  });

  const handleDragStart = (exam) => {
    setDraggedExam(exam);
  };

  const handleDrop = (day) => {
    if (!draggedExam || !onReschedule) return;
    const newDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onReschedule(draggedExam._id, newDate, draggedExam.time);
    setDraggedExam(null);
  };

  const getExamStatus = (exam) => {
    const examStart = new Date(`${exam.date}T${exam.time || '00:00'}`);
    return examStart > today ? 'upcoming' : examStart <= today && new Date(examStart.getTime() + (exam.duration || 60) * 60000) >= today ? 'ongoing' : 'completed';
  };

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const weekDays = viewMode === 'week' ? [] : DAYS;

  return (
    <div className="exam-calendar">
      <div className="calendar-header">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <h3>{MONTHS[currentMonth]} {currentYear}</h3>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>
      <div className="calendar-weekdays">
        {weekDays.map(d => <div key={d} className="cal-weekday">{d}</div>)}
      </div>
      <div className="calendar-grid">
        {calendarDays.map((day, idx) => {
          const examsForDay = day ? examsByDate[day] || [] : [];
          const isToday = day && today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
          return (
            <div
              key={idx}
              className={`cal-day ${!day ? 'cal-day-empty' : ''} ${isToday ? 'cal-day-today' : ''} ${draggedExam ? 'cal-day-drop' : ''}`}
              onDragOver={(e) => { if (day) e.preventDefault(); }}
              onDrop={(e) => { if (day) { e.preventDefault(); handleDrop(day); } }}
            >
              {day && <span className="cal-day-num">{day}</span>}
              <div className="cal-exams-list">
                {examsForDay.slice(0, 3).map(exam => (
                  <div
                    key={exam._id}
                    className={`cal-exam-chip ${getExamStatus(exam)}`}
                    style={{ borderLeftColor: getSubjectColor(exam.subjectName) }}
                    draggable={!!onReschedule}
                    onDragStart={() => handleDragStart(exam)}
                    title={`${exam.subjectName} — ${exam.time} (${exam.duration}min)`}
                  >
                    <span className="cal-chip-dot" style={{ background: getSubjectColor(exam.subjectName) }} />
                    <span className="cal-chip-text">{exam.subjectName}</span>
                    <span className="cal-chip-time">{exam.time}</span>
                  </div>
                ))}
                {examsForDay.length > 3 && (
                  <div className="cal-more">+{examsForDay.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="calendar-legend">
        {[...new Set(monthExams.map(e => e.subjectName))].map(name => (
          <div key={name} className="cal-legend-item">
            <span className="cal-legend-dot" style={{ background: getSubjectColor(name) }} />
            <span className="cal-legend-text">{name}</span>
          </div>
        ))}
        {monthExams.length === 0 && <span className="cal-no-exams">No exams this month</span>}
      </div>
    </div>
  );
};

export default ExamCalendar;
