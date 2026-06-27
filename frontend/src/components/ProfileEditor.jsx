import React, { useState } from 'react';
import { User, Link as LinkIcon, Briefcase, GraduationCap, Save, RefreshCw, Plus, Trash2, Globe, Tag } from 'lucide-react';
import { api } from '../api';

export default function ProfileEditor({ initialProfile, onSaveComplete, onReuploadRequested }) {
  const [profile, setProfile] = useState({ ...initialProfile });
  const [activeTab, setActiveTab] = useState('basic');
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Temporary skill state for interactive input
  const [newSkill, setNewSkill] = useState('');

  const handleBasicChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleLinkChange = (field, value) => {
    setProfile(prev => ({
      ...prev,
      links: { ...prev.links, [field]: value }
    }));
  };

  // Skill tag add/remove
  const handleAddSkill = (e) => {
    e.preventDefault();
    const cleanSkill = newSkill.trim();
    if (cleanSkill && !profile.skills.includes(cleanSkill)) {
      setProfile(prev => ({
        ...prev,
        skills: [...prev.skills, cleanSkill]
      }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setProfile(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skillToRemove)
    }));
  };

  // Experience dynamically add/remove/edit
  const handleExperienceChange = (index, field, value) => {
    const updated = [...profile.experience];
    updated[index] = { ...updated[index], [field]: value };
    setProfile(prev => ({ ...prev, experience: updated }));
  };

  const handleAddExperience = () => {
    setProfile(prev => ({
      ...prev,
      experience: [
        ...prev.experience,
        { company: '', role: '', startDate: '', endDate: '', description: '' }
      ]
    }));
  };

  const handleRemoveExperience = (index) => {
    setProfile(prev => ({
      ...prev,
      experience: prev.experience.filter((_, idx) => idx !== index)
    }));
  };

  // Education dynamically add/remove/edit
  const handleEducationChange = (index, field, value) => {
    const updated = [...profile.education];
    updated[index] = { ...updated[index], [field]: value };
    setProfile(prev => ({ ...prev, education: updated }));
  };

  const handleAddEducation = () => {
    setProfile(prev => ({
      ...prev,
      education: [
        ...prev.education,
        { school: '', degree: '', fieldOfStudy: '', graduationYear: '' }
      ]
    }));
  };

  const handleRemoveEducation = (index) => {
    setProfile(prev => ({
      ...prev,
      education: prev.education.filter((_, idx) => idx !== index)
    }));
  };

  const handleSave = async () => {
    setSaveLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const result = await api.saveProfile(profile);
      if (result && result.status === 'saved') {
        setSuccessMsg('Profile saved successfully!');
        setTimeout(() => {
          onSaveComplete(profile);
        }, 1200);
      } else {
        throw new Error('Save API did not return success status.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save profile. Make sure the backend server is running.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '32px', width: '100%', minHeight: '80vh' }}>
      
      {/* Sidebar Tabs */}
      <div className="glass-card" style={{ padding: '20px', height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', paddingLeft: '12px', marginBottom: '16px', letterSpacing: '1px' }}>Sections</h2>
        
        <button
          onClick={() => setActiveTab('basic')}
          style={{
            display: 'flex', alignItems: 'center', width: '100%', border: 'none', borderRadius: '10px',
            padding: '12px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            background: activeTab === 'basic' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'basic' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.3s ease', textAlign: 'left'
          }}
        >
          <User size={18} style={{ marginRight: '10px' }} /> Basic Details
        </button>

        <button
          onClick={() => setActiveTab('links')}
          style={{
            display: 'flex', alignItems: 'center', width: '100%', border: 'none', borderRadius: '10px',
            padding: '12px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            background: activeTab === 'links' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'links' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.3s ease', textAlign: 'left'
          }}
        >
          <LinkIcon size={18} style={{ marginRight: '10px' }} /> Links & Skills
        </button>

        <button
          onClick={() => setActiveTab('experience')}
          style={{
            display: 'flex', alignItems: 'center', width: '100%', border: 'none', borderRadius: '10px',
            padding: '12px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            background: activeTab === 'experience' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'experience' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.3s ease', textAlign: 'left'
          }}
        >
          <Briefcase size={18} style={{ marginRight: '10px' }} /> Experience ({profile.experience?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('education')}
          style={{
            display: 'flex', alignItems: 'center', width: '100%', border: 'none', borderRadius: '10px',
            padding: '12px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            background: activeTab === 'education' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'education' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.3s ease', textAlign: 'left'
          }}
        >
          <GraduationCap size={18} style={{ marginRight: '10px' }} /> Education ({profile.education?.length || 0})
        </button>

        <hr style={{ borderColor: 'var(--border)', margin: '16px 0' }} />

        <button
          onClick={onReuploadRequested}
          style={{
            display: 'flex', alignItems: 'center', width: '100%', border: '1px dashed var(--primary)', borderRadius: '10px',
            padding: '12px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            background: 'transparent', color: 'var(--primary)',
            transition: 'all 0.3s ease', textAlign: 'left'
          }}
        >
          <RefreshCw size={16} style={{ marginRight: '10px' }} /> Update Resume PDF
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="glass-card" style={{ padding: '40px', display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
        
        {/* Alerts */}
        {successMsg && (
          <div className="fade-in" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '12px 16px', color: '#a7f3d0', fontSize: '14px', marginBottom: '24px' }}>
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="fade-in" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '12px 16px', color: '#fca5a5', fontSize: '14px', marginBottom: '24px' }}>
            {errorMsg}
          </div>
        )}

        {/* 1. BASIC DETAILS TAB */}
        {activeTab === 'basic' && (
          <div className="fade-in" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Basic Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Full Name</label>
                <input
                  type="text"
                  value={profile.name || ''}
                  onChange={(e) => handleBasicChange('name', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Email Address</label>
                <input
                  type="email"
                  value={profile.email || ''}
                  onChange={(e) => handleBasicChange('email', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Phone Number</label>
                <input
                  type="text"
                  value={profile.phone || ''}
                  onChange={(e) => handleBasicChange('phone', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Location (City, State/Country)</label>
                <input
                  type="text"
                  value={profile.location || ''}
                  onChange={(e) => handleBasicChange('location', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>🎯 Target Job Title</label>
                <input
                  type="text"
                  value={profile.targetJob || ''}
                  onChange={(e) => handleBasicChange('targetJob', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>📍 Target Search Location</label>
                <input
                  type="text"
                  value={profile.targetLocation || ''}
                  onChange={(e) => handleBasicChange('targetLocation', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Professional Summary</label>
              <textarea
                value={profile.summary || ''}
                onChange={(e) => handleBasicChange('summary', e.target.value)}
                rows={5}
                style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          </div>
        )}

        {/* 2. LINKS & SKILLS TAB */}
        {activeTab === 'links' && (
          <div className="fade-in" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Links & Skills</h3>
            
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--primary)', marginBottom: '16px' }}>Social Profiles</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>GitHub URL</label>
                <input
                  type="text"
                  value={profile.links?.github || ''}
                  onChange={(e) => handleLinkChange('github', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>LinkedIn URL</label>
                <input
                  type="text"
                  value={profile.links?.linkedin || ''}
                  onChange={(e) => handleLinkChange('linkedin', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Twitter / X URL</label>
                <input
                  type="text"
                  value={profile.links?.twitter || ''}
                  onChange={(e) => handleLinkChange('twitter', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Personal Portfolio / Other Website</label>
                <input
                  type="text"
                  value={profile.links?.portfolio || ''}
                  onChange={(e) => handleLinkChange('portfolio', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
            </div>

            <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--primary)', marginBottom: '16px' }}>Interactive Skill Tags</h4>
            
            {/* Add Skill Form */}
            <form onSubmit={handleAddSkill} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Enter a new skill (e.g. Docker, Vue.js)..."
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
              />
              <button
                type="submit"
                style={{
                  display: 'flex', alignItems: 'center', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)',
                  border: '1px solid rgba(139, 92, 246, 0.3)', padding: '0 20px', borderRadius: '10px',
                  fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s ease'
                }}
              >
                <Plus size={16} style={{ marginRight: '6px' }} /> Add
              </button>
            </form>

            {/* Skills Tag Cloud */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: 'rgba(0, 0, 0, 0.1)' }}>
              {profile.skills?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No skills added yet.</p>
              ) : (
                profile.skills?.map((skill, index) => (
                  <span
                    key={index}
                    style={{
                      display: 'inline-flex', alignItems: 'center', background: 'rgba(139, 92, 246, 0.08)',
                      border: '1px solid rgba(139, 92, 246, 0.25)', padding: '6px 12px', borderRadius: '30px',
                      fontSize: '13px', fontWeight: '500', color: 'var(--text)'
                    }}
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--text-muted)',
                        marginLeft: '8px', cursor: 'pointer', fontSize: '11px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
                      }}
                      onMouseOver={(e) => e.target.style.color = 'var(--danger)'}
                      onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. EXPERIENCE TAB */}
        {activeTab === 'experience' && (
          <div className="fade-in" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '800' }}>Work Experience</h3>
              <button
                type="button"
                onClick={handleAddExperience}
                style={{
                  display: 'flex', alignItems: 'center', background: 'var(--primary)', color: '#fff',
                  border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s ease'
                }}
              >
                <Plus size={16} style={{ marginRight: '6px' }} /> Add Job
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {profile.experience?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>No experience listed. Click "Add Job" to add experience.</p>
              ) : (
                profile.experience?.map((exp, idx) => (
                  <div key={idx} className="fade-in" style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', background: 'rgba(255, 255, 255, 0.01)', position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveExperience(idx)}
                      style={{
                        position: 'absolute', top: '24px', right: '24px', border: 'none', background: 'transparent',
                        color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={18} />
                    </button>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px', maxWidth: '90%' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Company Name</label>
                        <input
                          type="text"
                          value={exp.company || ''}
                          onChange={(e) => handleExperienceChange(idx, 'company', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Role/Title</label>
                        <input
                          type="text"
                          value={exp.role || ''}
                          onChange={(e) => handleExperienceChange(idx, 'role', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Start Date</label>
                        <input
                          type="text"
                          value={exp.startDate || ''}
                          onChange={(e) => handleExperienceChange(idx, 'startDate', e.target.value)}
                          placeholder="e.g. Jan 2023"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>End Date</label>
                        <input
                          type="text"
                          value={exp.endDate || ''}
                          onChange={(e) => handleExperienceChange(idx, 'endDate', e.target.value)}
                          placeholder="e.g. Dec 2024 or Present"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Description / Highlights</label>
                      <textarea
                        value={exp.description || ''}
                        onChange={(e) => handleExperienceChange(idx, 'description', e.target.value)}
                        rows={4}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', resize: 'vertical', fontSize: '13px', fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 4. EDUCATION TAB */}
        {activeTab === 'education' && (
          <div className="fade-in" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '800' }}>Education History</h3>
              <button
                type="button"
                onClick={handleAddEducation}
                style={{
                  display: 'flex', alignItems: 'center', background: 'var(--primary)', color: '#fff',
                  border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s ease'
                }}
              >
                <Plus size={16} style={{ marginRight: '6px' }} /> Add Education
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {profile.education?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>No education listed. Click "Add Education" to add details.</p>
              ) : (
                profile.education?.map((edu, idx) => (
                  <div key={idx} className="fade-in" style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', background: 'rgba(255, 255, 255, 0.01)', position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveEducation(idx)}
                      style={{
                        position: 'absolute', top: '24px', right: '24px', border: 'none', background: 'transparent',
                        color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={18} />
                    </button>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '90%' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>School/University</label>
                        <input
                          type="text"
                          value={edu.school || ''}
                          onChange={(e) => handleEducationChange(idx, 'school', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Degree</label>
                        <input
                          type="text"
                          value={edu.degree || ''}
                          onChange={(e) => handleEducationChange(idx, 'degree', e.target.value)}
                          placeholder="e.g. Master of Science"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Field of Study</label>
                        <input
                          type="text"
                          value={edu.fieldOfStudy || ''}
                          onChange={(e) => handleEducationChange(idx, 'fieldOfStudy', e.target.value)}
                          placeholder="e.g. Computer Science"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Graduation Year</label>
                        <input
                          type="text"
                          value={edu.graduationYear || ''}
                          onChange={(e) => handleEducationChange(idx, 'graduationYear', e.target.value)}
                          placeholder="e.g. 2024"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer Save Row */}
        <div style={{ marginTop: 'auto', paddingTop: '32px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            disabled={saveLoading}
            className="btn-glow"
            style={{
              display: 'flex', alignItems: 'center', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              border: 'none', color: '#fff', fontSize: '15px', fontWeight: '600', padding: '12px 24px',
              borderRadius: '10px', cursor: saveLoading ? 'not-allowed' : 'pointer', opacity: saveLoading ? 0.7 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            <Save size={18} style={{ marginRight: '8px' }} />
            {saveLoading ? 'Saving...' : 'Confirm & Save Profile'}
          </button>
        </div>

      </div>

    </div>
  );
}
