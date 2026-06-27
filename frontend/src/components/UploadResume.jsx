import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../api';

export default function UploadResume({ onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);

  const loadingMessages = [
    'Reading resume PDF content...',
    'Loading Ollama AI models...',
    'Analyzing your skills and work history...',
    'Extracting education and social links...',
    'Synthesizing professional summary...',
    'Structuring final JSON profile (Almost done)...',
  ];

  // Rotate loading messages while Ollama works on CPU
  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
      }, 15000); // Shift message every 15 seconds
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    setError(null);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const selectedFile = droppedFiles[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
      } else {
        setError('Only PDF resumes are supported.');
      }
    }
  };

  const handleFileChange = (e) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
      } else {
        setError('Only PDF resumes are supported.');
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setLoadingStep(0);
    setError(null);

    try {
      const result = await api.uploadResume(file);
      if (result && result.profile) {
        onUploadComplete(result.profile);
      } else {
        throw new Error('Failed to extract structured profile.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during extraction. Make sure Ollama is running.');
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '40px', position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(9, 10, 15, 0.95)', borderRadius: '20px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            padding: '24px', zIndex: 10, textAlign: 'center'
          }}>
            {/* Spinning Loader */}
            <div style={{
              width: '60px', height: '60px',
              border: '3px solid rgba(139, 92, 246, 0.1)',
              borderTop: '3px solid var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '28px',
              boxShadow: '0 0 15px rgba(139, 92, 246, 0.2)'
            }}></div>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Parsing Resume PDF</h2>
            <p style={{ color: 'var(--primary)', fontSize: '15px', fontWeight: '500', minHeight: '24px' }}>
              {loadingMessages[loadingStep]}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '16px', maxWidth: '300px' }}>
              Local CPU parsing can take 1–3 minutes depending on your hardware. Please do not close this window.
            </p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '16px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)', marginBottom: '16px' }}>
            <Sparkles size={32} />
          </div>
          <h1 className="title-gradient" style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Get Started</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Upload your PDF resume. Ollama will analyze it and structure it.</p>
        </div>

        <form onSubmit={handleUpload}>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('resume-file-input').click()}
            className={`drop-zone ${isDragOver ? 'dragover' : ''}`}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: '16px',
              padding: '40px 20px',
              cursor: 'pointer',
              background: isDragOver ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255, 255, 255, 0.01)',
              borderColor: isDragOver ? 'var(--primary)' : 'var(--border)',
              transition: 'all 0.3s ease',
              textAlign: 'center'
            }}
          >
            <UploadCloud size={48} style={{ color: isDragOver ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '16px', transition: 'color 0.3s' }} />
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Drag & drop your PDF resume here, or <span style={{ color: 'var(--primary)', fontWeight: '600' }}>browse files</span>
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', opacity: 0.7 }}>Only supports PDF format</p>
            
            <input
              type="file"
              id="resume-file-input"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {file && (
            <div className="fade-in" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', marginTop: '20px' }}>
              <FileText size={20} style={{ color: 'var(--primary)', marginRight: '12px' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            </div>
          )}

          {error && (
            <div className="fade-in" style={{ display: 'flex', alignItems: 'flex-start', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '12px 16px', marginTop: '20px', color: '#fca5a5', fontSize: '13px' }}>
              <AlertCircle size={18} style={{ marginRight: '8px', flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          <button
            type="submit"
            className="btn-glow"
            disabled={!file || loading}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              border: 'none',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              padding: '14px 20px',
              borderRadius: '12px',
              cursor: (!file || loading) ? 'not-allowed' : 'pointer',
              marginTop: '28px',
              opacity: (!file || loading) ? 0.5 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            Upload & Parse Resume
          </button>
        </form>
      </div>
    </div>
  );
}
