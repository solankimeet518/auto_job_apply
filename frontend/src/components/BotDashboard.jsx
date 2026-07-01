import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Loader, HelpCircle, Terminal as TermIcon, Briefcase, MapPin } from 'lucide-react';
import { api } from '../api';

export default function BotDashboard({ profile }) {
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [targetJob, setTargetJob] = useState(profile.targetJob || '');
  const [targetLocations, setTargetLocations] = useState(profile.targetLocations || []);
  const [newLocation, setNewLocation] = useState('');

  const [targetJobTypes, setTargetJobTypes] = useState(profile.jobTypes || []);
  const [targetWorkModes, setTargetWorkModes] = useState(profile.workModes || []);

  const AVAILABLE_JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'];
  const AVAILABLE_WORK_MODES = ['Remote', 'Hybrid', 'On-site'];

  const handleCheckboxChange = (field, item, isChecked) => {
    if (field === 'jobTypes') {
      setTargetJobTypes(prev => isChecked ? [...prev, item] : prev.filter(x => x !== item));
    } else if (field === 'workModes') {
      setTargetWorkModes(prev => isChecked ? [...prev, item] : prev.filter(x => x !== item));
    }
  };
  
  // Answering state
  const [answerInput, setAnswerInput] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  const logEndRef = useRef(null);

  // Poll server status and logs every 1 second
  useEffect(() => {
    let pollInterval;
    
    async function fetchStatus() {
      try {
        const state = await api.getStatus();
        setStatus(state.status);
        setLogs(state.logs || []);
        setPendingQuestions(state.pendingQuestions || []);
      } catch (err) {
        console.error('Failed to poll status:', err);
      }
    }

    fetchStatus(); // initial fetch
    pollInterval = setInterval(fetchStatus, 1000);

    return () => clearInterval(pollInterval);
  }, []);

  // Auto-scroll logs terminal to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleStartBot = async () => {
    if (status === 'running' || status === 'paused_input') return;
    try {
      // Pass all runtime search parameters to start the bot
      await api.startBot(targetJob, targetLocations, targetJobTypes, targetWorkModes);
    } catch (err) {
      alert(`Failed to start bot: ${err.message}`);
    }
  };

  const handleStopBot = async () => {
    try {
      await api.stopBot();
    } catch (err) {
      alert(`Failed to stop bot: ${err.message}`);
    }
  };

  const handleAnswerSubmit = async (questionId, questionText) => {
    if (!answerInput.trim()) return;
    setSubmittingAnswer(true);
    try {
      await api.answerQuestion(questionId, answerInput);
      setAnswerInput('');
    } catch (err) {
      alert(`Failed to submit answer: ${err.message}`);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleAddLocation = (e) => {
    e.preventDefault();
    const clean = newLocation.trim();
    if (clean && !targetLocations.includes(clean)) {
      setTargetLocations(prev => [...prev, clean]);
      setNewLocation('');
    }
  };

  const handleRemoveLocation = (loc) => {
    setTargetLocations(prev => prev.filter(l => l !== loc));
  };

  // Determine status color/tag
  const getStatusDetails = () => {
    switch (status) {
      case 'running':
        return { label: 'Running', color: 'var(--success)', glowClass: 'status-indicator running' };
      case 'paused_input':
        return { label: 'Action Required', color: 'var(--warning)', glowClass: 'status-indicator paused' };
      case 'completed':
        return { label: 'Completed', color: '#60a5fa', glowClass: 'status-indicator completed' };
      case 'error':
        return { label: 'Error', color: 'var(--danger)', glowClass: 'status-indicator error' };
      case 'idle':
      default:
        return { label: 'Idle', color: 'var(--text-muted)', glowClass: 'status-indicator idle' };
    }
  };

  const statusInfo = getStatusDetails();

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px', width: '100%' }}>
      
      {/* Left Pane: Terminal Logs & Active Prompts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Active Out-of-Context Prompts */}
        {status === 'paused_input' && pendingQuestions.length > 0 && (
          <div className="fade-in" style={{
            background: 'rgba(245, 158, 11, 0.08)', border: '2px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '20px', padding: '32px', color: '#fff', boxShadow: '0 8px 32px rgba(245, 158, 11, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                display: 'flex', padding: '8px', borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)'
              }}>
                <HelpCircle size={24} />
              </div>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--warning)' }}>Action Required: AI Answering Assistance</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>The bot is paused. Answer this question to resume applying.</p>
              </div>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Form Question</span>
              <p style={{ fontSize: '15px', fontWeight: '600', color: '#fff', fontStyle: 'italic' }}>"{pendingQuestions[0].text}"</p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="Type your answer here (e.g. Yes, No, 3 years, 150000)..."
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAnswerSubmit(pendingQuestions[0].id, pendingQuestions[0].text);
                  }
                }}
                style={{ flex: 1, padding: '14px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: '#fff', outline: 'none' }}
              />
              <button
                onClick={() => handleAnswerSubmit(pendingQuestions[0].id, pendingQuestions[0].text)}
                disabled={submittingAnswer || !answerInput.trim()}
                style={{
                  background: 'var(--warning)', color: '#000', border: 'none', padding: '0 24px',
                  borderRadius: '10px', fontWeight: '700', cursor: (submittingAnswer || !answerInput.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (submittingAnswer || !answerInput.trim()) ? 0.7 : 1, transition: 'all 0.3s ease'
                }}
              >
                {submittingAnswer ? 'Submitting...' : 'Submit & Resume'}
              </button>
            </div>
          </div>
        )}

        {/* Live Logs Terminal */}
        <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <TermIcon size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '800' }}>Live Application Console</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={statusInfo.glowClass}></span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: statusInfo.color }}>{statusInfo.label}</span>
            </div>
          </div>

          {/* Terminal Screen */}
          <div style={{
            flex: 1, background: '#090a0f', border: '1px solid var(--border)', borderRadius: '12px',
            padding: '20px', fontFamily: '"Courier New", Courier, monospace', fontSize: '13px',
            color: '#a7f3d0', overflowY: 'auto', maxHeight: '420px', minHeight: '350px',
            lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', fontStyle: 'italic' }}>
                Console idle. Click "Start Application Loop" to begin Indeed automation.
              </div>
            ) : (
              logs.map((log, index) => {
                let color = '#d1fae5'; // default success green
                if (log.includes('❌') || log.includes('🚨')) color = '#fca5a5'; // red for errors
                if (log.includes('⚠️') || log.includes('PAUSED')) color = '#fef3c7'; // yellow for warnings
                if (log.includes('🚀') || log.includes('🌐')) color = '#c084fc'; // purple for starts/navigation
                return (
                  <div key={index} style={{ color, wordBreak: 'break-all' }}>
                    {log}
                  </div>
                );
              })
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Right Pane: Controls & Configurations */}
      <div className="glass-card" style={{ padding: '32px', height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Apply Controls</h3>
        
        {/* Start/Stop Button triggers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(status === 'running' || status === 'paused_input') ? (
            <button
              onClick={handleStopBot}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                width: '100%', padding: '16px', background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)',
                borderRadius: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
            >
              <Square size={18} fill="currentColor" /> Stop Apply Bot
            </button>
          ) : (
            <button
              onClick={handleStartBot}
              disabled={targetLocations.length === 0 || !targetJob.trim()}
              className="btn-glow"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                border: 'none', color: '#fff', borderRadius: '12px', fontWeight: '700', 
                cursor: (targetLocations.length === 0 || !targetJob.trim()) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease', opacity: (targetLocations.length === 0 || !targetJob.trim()) ? 0.6 : 1
              }}
            >
              <Play size={18} fill="currentColor" /> Start Application Loop
            </button>
          )}
        </div>

        {/* Runtime config overrides */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Runtime Configuration</h4>

          {/* Target Job Title */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>
              <Briefcase size={14} /> TARGET JOB TITLE
            </label>
            <input
              type="text"
              value={targetJob}
              onChange={(e) => setTargetJob(e.target.value)}
              disabled={status === 'running' || status === 'paused_input'}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px', opacity: (status === 'running' || status === 'paused_input') ? 0.6 : 1 }}
            />
          </div>

          {/* Target Locations List */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>
              <MapPin size={14} /> SEARCH LOCATIONS
            </label>
            
            {status !== 'running' && status !== 'paused_input' && (
              <form onSubmit={handleAddLocation} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder="e.g. Remote, Dallas"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '13px' }}
                />
                <button type="submit" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '0 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                  Add
                </button>
              </form>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.15)', minHeight: '36px' }}>
              {targetLocations.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No locations configured.</span>
              ) : (
                targetLocations.map((loc, index) => (
                  <span
                    key={index}
                    style={{
                      display: 'inline-flex', alignItems: 'center', background: 'rgba(139, 92, 246, 0.06)',
                      border: '1px solid rgba(139, 92, 246, 0.2)', padding: '3px 8px', borderRadius: '30px',
                      fontSize: '12px', color: 'var(--text)'
                    }}
                  >
                    {loc}
                    {(status !== 'running' && status !== 'paused_input') && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLocation(loc)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', marginLeft: '6px', cursor: 'pointer', fontSize: '10px' }}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Job Types Selection */}
          <div style={{ marginTop: '4px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>💼 Job Types</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.15)' }}>
              {AVAILABLE_JOB_TYPES.map(type => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: (status === 'running' || status === 'paused_input') ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={targetJobTypes.includes(type)}
                    disabled={status === 'running' || status === 'paused_input'}
                    onChange={(e) => handleCheckboxChange('jobTypes', type, e.target.checked)}
                    style={{ width: '14px', height: '14px', accentColor: 'var(--primary)' }}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

          {/* Work Modes Selection */}
          <div style={{ marginTop: '4px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>🏢 Work Modes</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.15)' }}>
              {AVAILABLE_WORK_MODES.map(mode => (
                <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: (status === 'running' || status === 'paused_input') ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={targetWorkModes.includes(mode)}
                    disabled={status === 'running' || status === 'paused_input'}
                    onChange={(e) => handleCheckboxChange('workModes', mode, e.target.checked)}
                    style={{ width: '14px', height: '14px', accentColor: 'var(--primary)' }}
                  />
                  {mode}
                </label>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
