import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './api';
import UploadResume from './components/UploadResume';
import ProfileEditor from './components/ProfileEditor';
import { Terminal } from 'lucide-react';

function App() {
  const [screen, setScreen] = useState('loading'); // 'loading' | 'uploader' | 'editor'
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function checkProfile() {
      try {
        const result = await api.getProfile();
        if (result && result.status === 'configured' && result.profile) {
          setProfile(result.profile);
          setScreen('editor');
        } else {
          setScreen('uploader');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setScreen('uploader');
      }
    }
    checkProfile();
  }, []);

  return (
    <div className="app-container">
      {/* Navbar Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid var(--border)', paddingBottom: '20px', marginBottom: '40px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex', padding: '8px', borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
            color: '#fff'
          }}>
            <Terminal size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '0.5px' }}>Indeed Apply Bot</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Local Ollama Automation</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '20px' }}>
          <span className="status-indicator idle"></span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Status: Config Mode</span>
        </div>
      </header>

      {/* Screen Routing */}
      {screen === 'loading' && (
        <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '2px solid rgba(139, 92, 246, 0.1)',
            borderTop: '2px solid var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }}></div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading configuration...</p>
        </div>
      )}

      {screen === 'uploader' && (
        <UploadResume onUploadComplete={(extractedProfile) => {
          setProfile(extractedProfile);
          setScreen('editor');
        }} />
      )}

      {screen === 'editor' && (
        <ProfileEditor
          initialProfile={profile}
          onSaveComplete={(savedProfile) => {
            setProfile(savedProfile);
          }}
          onReuploadRequested={() => {
            setScreen('uploader');
          }}
        />
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
