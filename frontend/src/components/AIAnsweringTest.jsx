import React, { useState } from 'react';
import { Cpu } from 'lucide-react';
import { api } from '../api';

export default function AIAnsweringTest() {
  const [testQuestion, setTestQuestion] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  const handleTestQuery = async () => {
    if (!testQuestion.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await api.queryTest(testQuestion);
      setTestResult(res);
    } catch (err) {
      console.error(err);
      setTestResult({ error: err.message });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="glass-card fade-in" style={{ padding: '40px', minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div style={{
          display: 'flex', padding: '8px', borderRadius: '10px',
          background: 'rgba(16, 185, 129, 0.1)', color: '#10b981'
        }}>
          <Cpu size={24} />
        </div>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: '800' }}>AI Answering Test</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Validate Ollama's ability to auto-fill form questions based on your profile</p>
        </div>
      </div>

      <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: '1.6' }}>
        Type any question that a job portal might ask (e.g. about years of experience with a tool, salary expectations, or why you fit the role). 
        The query engine will attempt to generate an answer based on your profile details, or flag it as out-of-context.
      </p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
        <input
          type="text"
          placeholder="e.g. How many years of experience do you have with React? or What is your expected salary?"
          value={testQuestion}
          onChange={(e) => setTestQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleTestQuery();
            }
          }}
          style={{ flex: 1, padding: '14px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
        />
        <button
          type="button"
          onClick={handleTestQuery}
          disabled={testLoading || !testQuestion.trim()}
          style={{
            background: 'var(--primary)', color: '#fff', border: 'none', padding: '0 24px',
            borderRadius: '10px', fontWeight: '600', cursor: (testLoading || !testQuestion.trim()) ? 'not-allowed' : 'pointer',
            opacity: (testLoading || !testQuestion.trim()) ? 0.7 : 1, transition: 'all 0.3s ease'
          }}
        >
          {testLoading ? 'Analyzing...' : 'Test Answering'}
        </button>
      </div>

      {testResult && (
        <div className="fade-in" style={{ marginTop: '12px' }}>
          <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Result</h4>
          {testResult.error ? (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '20px', color: '#fca5a5' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '15px' }}>❌ SERVER ERROR</div>
              <p style={{ fontSize: '13px', opacity: 0.9 }}>
                {testResult.error}. Make sure the backend server is running and Ollama is online.
              </p>
            </div>
          ) : testResult.outOfContext ? (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '20px', color: '#fef3c7' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '15px' }}>⚠️ OUT OF CONTEXT</div>
              <p style={{ fontSize: '13px', opacity: 0.9 }}>
                The AI could not confidently answer this question using only the facts in your resume profile. 
                When running the job apply bot, it will pause and ask for your input in the browser, saving your answer so it never asks again.
              </p>
            </div>
          ) : (
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '20px', color: '#ecfdf5' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--success)', fontSize: '15px' }}>✅ ANSWER GENERATED</div>
              <blockquote style={{ fontSize: '14px', fontStyle: 'italic', borderLeft: '3px solid var(--success)', paddingLeft: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '6px' }}>
                "{testResult.answer}"
              </blockquote>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
