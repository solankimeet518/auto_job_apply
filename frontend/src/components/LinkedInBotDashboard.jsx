import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RefreshCw, Send, Users, ShieldAlert, Sparkles, Terminal, CheckCircle2, AlertCircle, FileText, Sliders, BookOpen, Plus, Trash2, RotateCcw } from 'lucide-react';
import { api } from '../api';

export default function LinkedInBotDashboard({ profile }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'paused_login' | 'completed' | 'error'
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ visited: 0, sent: 0, skipped: 0, currentPage: 1 });
  const [loadingAction, setLoadingAction] = useState(false);

  const getDefaultLocation = () => {
    if (profile?.targetLocations && profile.targetLocations.length > 0) {
      return profile.targetLocations[0];
    }
    return profile?.targetLocation || profile?.city || profile?.location || '';
  };

  // Configuration Form State
  const [keywords, setKeywords] = useState(profile?.targetJob ? `${profile.targetJob} Recruiter` : 'Software Engineer Recruiter');
  const [location, setLocation] = useState(getDefaultLocation);
  const [network2nd, setNetwork2nd] = useState(true);
  const [network3rd, setNetwork3rd] = useState(true);
  const [maxInvites, setMaxInvites] = useState(25);
  const [noteMode, setNoteMode] = useState('ai'); // 'ai' | 'template'
  const [customTemplate, setCustomTemplate] = useState('Hi {name}, I noticed your work at {company} and would love to connect. I am an experienced {targetJob} exploring new opportunities.');

  // Update defaults when profile is loaded
  useEffect(() => {
    if (profile) {
      if (profile.targetLocations && profile.targetLocations.length > 0) {
        setLocation(profile.targetLocations[0]);
      } else if (profile.targetLocation) {
        setLocation(profile.targetLocation);
      }
      if (profile.targetJob) {
        setKeywords(`${profile.targetJob} Recruiter`);
      }
    }
  }, [profile]);

  // AI Note Fine-Tuning Studio State
  const [tone, setTone] = useState('Professional'); // 'Professional' | 'Friendly & Casual' | 'Direct & Concise' | 'Technical Focus'
  const [customInstructions, setCustomInstructions] = useState('');
  const [temperature, setTemperature] = useState(0.3);
  const [showAiStudio, setShowAiStudio] = useState(false);

  // Dynamic Few-Shot Training Samples (Sample Inputs & Desired Outputs)
  const DEFAULT_SAMPLES = [
    {
      id: 'default-1',
      recipient: 'Anshuman Singh, Technical Recruiter at TechCorp',
      note: `Hi Anshuman, I came across your profile and would love to connect. As a Software Engineer exploring new opportunities, I'd appreciate staying in touch regarding future engineering openings. Best, ${profile?.firstName || 'Meet'}`,
    },
    {
      id: 'default-2',
      recipient: 'Raagavi Manikandan, Talent Acquisition Partner',
      note: `Hi Raagavi, I'd love to connect! I'm a Software Engineer actively exploring relevant opportunities. I'd love to stay connected with your talent network for upcoming roles. Best, ${profile?.firstName || 'Meet'}`,
    },
    {
      id: 'default-3',
      recipient: 'Sarah Connor, Engineering Manager',
      note: `Hi Sarah, I noticed your work leading engineering teams and would love to connect. I'm a Software Engineer interested in following your team's insights and potential openings. Best, ${profile?.firstName || 'Meet'}`,
    },
  ];

  const [sampleExamples, setSampleExamples] = useState(() => {
    try {
      const saved = localStorage.getItem('linkedin_sample_examples');
      return saved ? JSON.parse(saved) : DEFAULT_SAMPLES;
    } catch (_) {
      return DEFAULT_SAMPLES;
    }
  });

  const [newRecipient, setNewRecipient] = useState('');
  const [newNote, setNewNote] = useState('');
  const [showAddSample, setShowAddSample] = useState(false);

  const saveSamples = (updated) => {
    setSampleExamples(updated);
    try {
      localStorage.setItem('linkedin_sample_examples', JSON.stringify(updated));
    } catch (_) {}
  };

  const handleAddSample = () => {
    if (!newRecipient.trim() || !newNote.trim()) {
      alert('Please enter both the sample Recipient details and the Desired Note.');
      return;
    }
    const updated = [
      ...sampleExamples,
      {
        id: Date.now().toString(),
        recipient: newRecipient.trim(),
        note: newNote.trim(),
      },
    ];
    saveSamples(updated);
    setNewRecipient('');
    setNewNote('');
    setShowAddSample(false);
  };

  const handleDeleteSample = (id) => {
    const updated = sampleExamples.filter(s => s.id !== id);
    saveSamples(updated);
  };

  const handleResetSamples = () => {
    saveSamples(DEFAULT_SAMPLES);
  };

  // Note Preview & Testing State
  const [testRecipientName, setTestRecipientName] = useState('Anshuman Singh');
  const [testRecipientRole, setTestRecipientRole] = useState('Technical Recruiter at Google');
  const [previewNote, setPreviewNote] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleGeneratePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await api.previewLinkedInNote({
        personName: testRecipientName || 'Anshuman Singh',
        personRole: testRecipientRole || 'Technical Recruiter',
        personCompany: 'Google',
        targetJob: keywords || 'Software Engineer',
        noteMode,
        customTemplate,
        tone,
        customInstructions,
        temperature,
        sampleExamples,
      });
      if (res && res.note) {
        setPreviewNote(res.note);
      }
    } catch (err) {
      console.error('Failed to preview note:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const terminalBodyRef = useRef(null);
  const isUserScrolledUp = useRef(false);

  // Poll status from backend
  useEffect(() => {
    let isMounted = true;

    async function fetchStatus() {
      try {
        const data = await api.getLinkedInStatus();
        if (isMounted && data) {
          setStatus(data.status || 'idle');
          setLogs(data.logs || []);
          if (data.stats) {
            setStats(data.stats);
          }
        }
      } catch (err) {
        console.error('Failed to poll LinkedIn status:', err);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Internal Terminal-only auto-scroll (never steals window/page scroll)
  useEffect(() => {
    if (terminalBodyRef.current && !isUserScrolledUp.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  const handleTerminalScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // If user scrolled up more than 40px from bottom, pause terminal auto-scroll
    isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 40;
  };

  const handleStart = async () => {
    setLoadingAction(true);
    try {
      await api.startLinkedInBot({
        keywords,
        location,
        network2nd,
        network3rd,
        maxInvites: Number(maxInvites) || 25,
        noteMode,
        customTemplate: noteMode === 'template' ? customTemplate : '',
        tone,
        customInstructions,
        temperature,
        sampleExamples,
      });
      setStatus('running');
    } catch (err) {
      alert(`Failed to start LinkedIn bot: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStop = async () => {
    setLoadingAction(true);
    try {
      await api.stopLinkedInBot();
      setStatus('idle');
    } catch (err) {
      alert(`Failed to stop LinkedIn bot: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14, 118, 168, 0.15) 0%, rgba(0, 160, 220, 0.05) 100%)',
        border: '1px solid rgba(14, 118, 168, 0.3)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: '#0A66C2', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '24px', fontWeight: '800'
          }}>
            in
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#fff' }}>LinkedIn Outreach & Note Bot</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Automated connection requests with AI-personalized invitation notes (<span style={{ color: '#0A66C2' }}>&le; 280 chars</span>).
            </p>
          </div>
        </div>

        {/* Status Indicator Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            padding: '8px 16px', borderRadius: '24px'
          }}>
            <span className={`status-indicator ${status}`}></span>
            <span style={{ fontSize: '13px', fontWeight: '700', textTransform: 'capitalize' }}>
              {status === 'paused_login' ? '🔒 Paused (Login Needed)' : status}
            </span>
          </div>

          {status === 'running' || status === 'paused_login' ? (
            <button
              onClick={handleStop}
              disabled={loadingAction}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#EF4444', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: '10px', fontWeight: '700',
                cursor: 'pointer', transition: 'all 0.2s ease'
              }}
            >
              <Square size={16} /> Stop Outreach
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={loadingAction}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#0A66C2', color: '#fff', border: 'none',
                padding: '10px 22px', borderRadius: '10px', fontWeight: '700',
                cursor: 'pointer', transition: 'all 0.2s ease',
                boxShadow: '0 4px 14px rgba(10, 102, 194, 0.4)'
              }}
            >
              <Play size={16} /> Start Outreach
            </button>
          )}
        </div>
      </div>

      {/* Stats Counter Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Invitations Sent</span>
            <Send size={16} color="#10B981" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#10B981' }}>{stats.sent}</div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Profiles Visited</span>
            <Users size={16} color="#3B82F6" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#3B82F6' }}>{stats.visited}</div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Skipped (No Connect)</span>
            <AlertCircle size={16} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#F59E0B' }}>{stats.skipped}</div>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Current Search Page</span>
            <FileText size={16} color="#8B5CF6" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#8B5CF6' }}>Page {stats.currentPage}</div>
        </div>
      </div>

      {/* Main Grid: Parameters & Terminal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left: Configuration Form */}
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px',
          display: 'flex', flexDirection: 'column', gap: '20px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '12px', margin: 0 }}>
            🎯 Search & Target Settings
          </h3>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Target Keywords / Role
            </label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="e.g. Software Engineer Recruiter, Engineering Manager..."
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '10px',
                background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none'
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                📍 Target Location Filter
              </label>
              {profile?.targetLocations?.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From Target Locations</span>
              )}
            </div>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. India, United States, Bengaluru..."
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '10px',
                background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none'
              }}
            />
            {profile?.targetLocations && profile.targetLocations.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>Quick select:</span>
                {profile.targetLocations.map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    style={{
                      fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
                      background: location === loc ? 'rgba(10, 102, 194, 0.3)' : 'rgba(255,255,255,0.05)',
                      color: location === loc ? '#38BDF8' : 'var(--text-muted)',
                      border: location === loc ? '1px solid #0A66C2' : '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Network Connections Checkboxes */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Network Connection Levels
            </label>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={network2nd}
                  onChange={e => setNetwork2nd(e.target.checked)}
                  style={{ accentColor: '#0A66C2', width: '16px', height: '16px' }}
                />
                2nd Degree Connections
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={network3rd}
                  onChange={e => setNetwork3rd(e.target.checked)}
                  style={{ accentColor: '#0A66C2', width: '16px', height: '16px' }}
                />
                3rd+ Degree Connections
              </label>
            </div>
          </div>

          {/* Max Daily Invites Limit */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Max Invitations per Session
              </label>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0A66C2' }}>{maxInvites} Invites</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={maxInvites}
              onChange={e => setMaxInvites(e.target.value)}
              style={{ width: '100%', accentColor: '#0A66C2' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Recommended: 20-30 invites daily to keep your account safe from restrictions.
            </span>
          </div>

          {/* Note Mode Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Invitation Note Generation Mode
            </label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setNoteMode('ai')}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: noteMode === 'ai' ? 'rgba(10, 102, 194, 0.2)' : 'var(--input-bg)',
                  borderColor: noteMode === 'ai' ? '#0A66C2' : 'var(--border)',
                  color: noteMode === 'ai' ? '#fff' : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <Sparkles size={16} color="#0A66C2" /> 🤖 AI Personalized (Ollama)
              </button>

              <button
                type="button"
                onClick={() => setNoteMode('template')}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: noteMode === 'template' ? 'rgba(10, 102, 194, 0.2)' : 'var(--input-bg)',
                  borderColor: noteMode === 'template' ? '#0A66C2' : 'var(--border)',
                  color: noteMode === 'template' ? '#fff' : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <FileText size={16} /> ✍️ Custom Template
              </button>
            </div>

            {noteMode === 'ai' && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '14px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={14} color="#0A66C2" /> AI Fine-Tuning Studio
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customize tone & instructions</span>
                </div>

                {/* Tone Presets */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Tone & Persona Preset
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {[
                      { id: 'Professional', label: '💼 Professional', desc: 'Polished & career-focused' },
                      { id: 'Friendly & Casual', label: '😊 Friendly & Casual', desc: 'Warm & conversational' },
                      { id: 'Direct & Concise', label: '⚡ Direct & Concise', desc: 'Under 180 chars' },
                      { id: 'Technical Focus', label: '🛠️ Technical Focus', desc: 'Architecture & stack' }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTone(t.id)}
                        style={{
                          padding: '8px 10px', borderRadius: '6px', textAlign: 'left',
                          background: tone === t.id ? 'rgba(10, 102, 194, 0.2)' : 'var(--input-bg)',
                          border: tone === t.id ? '1px solid #0A66C2' : '1px solid rgba(255,255,255,0.07)',
                          color: tone === t.id ? '#38BDF8' : 'var(--text-muted)',
                          cursor: 'pointer', transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: '700' }}>{t.label}</div>
                        <div style={{ fontSize: '10px', opacity: 0.8 }}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Fine-Tuning Instructions */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Custom Instructions / Focus Areas (Prompt Modifier)
                  </label>
                  <textarea
                    rows="2"
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                    placeholder="e.g. Mention 2+ years of React/Node.js experience, keep it under 200 chars, highlight open source interest..."
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '6px',
                      background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '12px'
                    }}
                  />
                </div>

                {/* Temperature / Creativity Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Model Temperature (Creativity)
                    </label>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#0A66C2' }}>{temperature} ({temperature <= 0.2 ? 'Strict' : temperature <= 0.4 ? 'Balanced' : 'Creative'})</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.7"
                    step="0.1"
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#0A66C2' }}
                  />
                </div>

                {/* Dynamic Few-Shot Training Samples Manager */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BookOpen size={13} color="#38BDF8" /> Sample Examples ({sampleExamples.length})
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleResetSamples}
                        title="Reset to default examples"
                        style={{
                          background: 'transparent', border: 'none', color: 'var(--text-muted)',
                          fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px'
                        }}
                      >
                        <RotateCcw size={11} /> Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddSample(!showAddSample)}
                        style={{
                          background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38BDF8', borderRadius: '4px', padding: '2px 8px', fontSize: '11px',
                          fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Plus size={12} /> {showAddSample ? 'Cancel' : 'Add Sample'}
                      </button>
                    </div>
                  </div>

                  {/* Add Sample Inline Form */}
                  {showAddSample && (
                    <div style={{
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '8px', padding: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px'
                    }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                          Sample Recipient Context (Input):
                        </label>
                        <input
                          type="text"
                          value={newRecipient}
                          onChange={e => setNewRecipient(e.target.value)}
                          placeholder="e.g. Priya Patel, Senior Engineering Manager at Stripe"
                          style={{
                            width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '4px',
                            background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)'
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            Desired Note Output (Output):
                          </label>
                          <span style={{ fontSize: '10px', color: newNote.length <= 260 ? '#10B981' : '#EF4444' }}>
                            {newNote.length} / 260 chars
                          </span>
                        </div>
                        <textarea
                          rows="2"
                          value={newNote}
                          onChange={e => setNewNote(e.target.value)}
                          placeholder="e.g. Hi Priya, I noticed Stripe's impressive work in payments and would love to connect. I'm a Backend Engineer keen to follow your team's updates! Best, Meet"
                          style={{
                            width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '4px',
                            background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)'
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddSample}
                        style={{
                          alignSelf: 'flex-end', background: '#0A66C2', color: '#fff', border: 'none',
                          borderRadius: '4px', padding: '4px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                        }}
                      >
                        💾 Save Sample Example
                      </button>
                    </div>
                  )}

                  {/* List of active samples */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {sampleExamples.map((s, idx) => (
                      <div
                        key={s.id || idx}
                        style={{
                          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px', padding: '8px', display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#38BDF8', marginBottom: '2px' }}>
                            👤 {s.recipient}
                          </div>
                          <div style={{ fontSize: '11px', color: '#CBD5E1', fontStyle: 'italic', lineHeight: '1.4' }}>
                            "{s.note}"
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSample(s.id)}
                          title="Delete sample"
                          style={{
                            background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.7)',
                            cursor: 'pointer', padding: '2px', alignSelf: 'center'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {noteMode === 'template' && (
              <div style={{ marginTop: '8px' }}>
                <textarea
                  rows="3"
                  value={customTemplate}
                  onChange={e => setCustomTemplate(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '13px'
                  }}
                />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tags:</span>
                  {['{name}', '{company}', '{role}', '{targetJob}', '{myName}'].map(tag => (
                    <span key={tag} style={{
                      fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)', color: '#0A66C2', border: '1px solid rgba(10, 102, 194, 0.3)'
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Note Tester / Preview Generator */}
          <div style={{
            background: 'rgba(10, 102, 194, 0.05)', border: '1px dashed rgba(10, 102, 194, 0.3)',
            borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="#38BDF8" />
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#38BDF8', textTransform: 'uppercase' }}>
                  🧪 Test Note Output Before Starting
                </span>
              </div>
              <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={previewLoading}
                style={{
                  background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
                  color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px',
                  fontSize: '12px', fontWeight: '700', cursor: previewLoading ? 'not-allowed' : 'pointer',
                  opacity: previewLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                {previewLoading ? 'Generating...' : '⚡ Generate AI Preview'}
              </button>
            </div>

            {/* Test Sample Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                type="text"
                value={testRecipientName}
                onChange={e => setTestRecipientName(e.target.value)}
                placeholder="Sample Name (e.g. Anshuman Singh)"
                style={{
                  padding: '6px 10px', fontSize: '12px', borderRadius: '6px',
                  background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)'
                }}
              />
              <input
                type="text"
                value={testRecipientRole}
                onChange={e => setTestRecipientRole(e.target.value)}
                placeholder="Sample Role (e.g. Tech Recruiter)"
                style={{
                  padding: '6px 10px', fontSize: '12px', borderRadius: '6px',
                  background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)'
                }}
              />
            </div>

            {/* Rendered Preview Box */}
            {previewNote && (
              <div style={{
                background: '#0B1120', border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px', padding: '12px', position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Generated Note for {testRecipientName}:</span>
                  <span style={{
                    fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                    background: previewNote.length <= 280 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: previewNote.length <= 280 ? '#10B981' : '#EF4444'
                  }}>
                    {previewNote.length} / 280 chars
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#E2E8F0', lineHeight: '1.5', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                  "{previewNote}"
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Terminal Logs */}
        <div style={{
          background: '#090D16', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px',
          display: 'flex', flexDirection: 'column', height: '600px'
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '12px', marginBottom: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={18} color="#0A66C2" />
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>Live Activity Console</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{logs.length} events logged</span>
          </div>

          <div
            ref={terminalBodyRef}
            onScroll={handleTerminalScroll}
            style={{
              flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px',
              lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '6px'
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '100px' }}>
                <Users size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <p>Click "Start Outreach" to begin scanning and connecting with professionals.</p>
              </div>
            ) : (
              logs.map((log, index) => {
                let color = '#E2E8F0';
                if (log.includes('✅') || log.includes('✉️')) color = '#10B981';
                else if (log.includes('⚠️') || log.includes('🔒') || log.includes('PAUSED')) color = '#F59E0B';
                else if (log.includes('🛑') || log.includes('🚨') || log.includes('Error')) color = '#EF4444';
                else if (log.includes('🔎') || log.includes('👤') || log.includes('🌐')) color = '#38BDF8';
                else if (log.includes('✍️')) color = '#C084FC';

                return (
                  <div key={index} style={{ color, wordBreak: 'break-word' }}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
