import React, { useState } from 'react';
import { User, Link as LinkIcon, Briefcase, GraduationCap, Save, RefreshCw, Plus, Trash2, Globe, Tag, Folder, Award } from 'lucide-react';
import { api } from '../api';

export default function ProfileEditor({ initialProfile, onSaveComplete, onReuploadRequested }) {
  const [profile, setProfile] = useState(() => {
    const prof = { ...initialProfile };
    // Handle name split if it comes as a single name from a legacy configuration
    if (prof.name && !prof.firstName && !prof.lastName) {
      const parts = prof.name.trim().split(/\s+/);
      prof.firstName = parts[0] || '';
      prof.lastName = parts.slice(1).join(' ') || '';
    }
    prof.firstName = prof.firstName || '';
    prof.lastName = prof.lastName || '';
    prof.address = prof.address || '';
    prof.city = prof.city || '';
    prof.state = prof.state || '';
    prof.pincode = prof.pincode || '';
    prof.country = prof.country || '';
    prof.targetLocations = prof.targetLocations || (prof.targetLocation ? [prof.targetLocation] : []);
    prof.jobTypes = prof.jobTypes || [];
    prof.workModes = prof.workModes || [];
    prof.currentCTC = prof.currentCTC || '';
    prof.expectedCTC = prof.expectedCTC || '';

    const skills = prof.skills || {};
    if (Array.isArray(skills)) {
      prof.skills = {
        languages: [],
        frameworks: [],
        databases: [],
        devops: [],
        tools: skills
      };
    } else {
      prof.skills = {
        languages: skills.languages || [],
        frameworks: skills.frameworks || [],
        databases: skills.databases || [],
        devops: skills.devops || [],
        tools: skills.tools || []
      };
    }

    return prof;
  });
  const [activeTab, setActiveTab] = useState('basic');
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Temporary interactive states
  const [newSkillsInput, setNewSkillsInput] = useState({
    languages: '',
    frameworks: '',
    databases: '',
    devops: '',
    tools: ''
  });
  const [newLocation, setNewLocation] = useState('');
  const [newAchievement, setNewAchievement] = useState('');

  // Wizard tab sequence
  const TABS_SEQUENCE = ['basic', 'links', 'experience', 'education', 'projects', 'additional'];

  const handleNext = () => {
    const currentIndex = TABS_SEQUENCE.indexOf(activeTab);
    if (currentIndex < TABS_SEQUENCE.length - 1) {
      setActiveTab(TABS_SEQUENCE[currentIndex + 1]);
    }
  };

  const handlePrev = () => {
    const currentIndex = TABS_SEQUENCE.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(TABS_SEQUENCE[currentIndex - 1]);
    }
  };

  const AVAILABLE_JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'];
  const AVAILABLE_WORK_MODES = ['Remote', 'Hybrid', 'On-site'];

  const handleCheckboxChange = (field, item, isChecked) => {
    setProfile(prev => {
      const current = prev[field] || [];
      const updated = isChecked
        ? [...current, item]
        : current.filter(x => x !== item);
      return { ...prev, [field]: updated };
    });
  };

  const handleAddLocation = (e) => {
    e.preventDefault();
    const cleanLoc = newLocation.trim();
    if (cleanLoc && !profile.targetLocations.includes(cleanLoc)) {
      setProfile(prev => ({
        ...prev,
        targetLocations: [...prev.targetLocations, cleanLoc]
      }));
      setNewLocation('');
    }
  };

  const handleRemoveLocation = (locToRemove) => {
    setProfile(prev => ({
      ...prev,
      targetLocations: prev.targetLocations.filter(l => l !== locToRemove)
    }));
  };

  // Project handlers
  const handleProjectChange = (index, field, value) => {
    const updated = [...profile.projects];
    updated[index] = { ...updated[index], [field]: value };
    setProfile(prev => ({ ...prev, projects: updated }));
  };

  const handleAddProject = () => {
    setProfile(prev => ({
      ...prev,
      projects: [
        ...prev.projects,
        { title: '', role: '', technologies: [], description: '', link: '' }
      ]
    }));
  };

  const handleRemoveProject = (index) => {
    setProfile(prev => ({
      ...prev,
      projects: prev.projects.filter((_, idx) => idx !== index)
    }));
  };

  // Achievement handlers
  const handleAddAchievement = (e) => {
    e.preventDefault();
    const cleanAch = newAchievement.trim();
    if (cleanAch && !profile.keyAchievements.includes(cleanAch)) {
      setProfile(prev => ({
        ...prev,
        keyAchievements: [...prev.keyAchievements, cleanAch]
      }));
      setNewAchievement('');
    }
  };

  const handleRemoveAchievement = (achToRemove) => {
    setProfile(prev => ({
      ...prev,
      keyAchievements: prev.keyAchievements.filter(a => a !== achToRemove)
    }));
  };

  const handleBasicChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleLinkChange = (field, value) => {
    setProfile(prev => ({
      ...prev,
      links: { ...prev.links, [field]: value }
    }));
  };

  const handleSkillsInputChange = (category, val) => {
    setNewSkillsInput(prev => ({ ...prev, [category]: val }));
  };

  const handleAddSkill = (category) => {
    const rawVal = newSkillsInput[category] || '';
    const cleanSkill = rawVal.trim();
    if (cleanSkill) {
      const skillsToAdd = cleanSkill.split(',').map(s => s.trim()).filter(Boolean);
      setProfile(prev => {
        const skillsObj = prev.skills || {};
        const currentCat = skillsObj[category] || [];
        const newCat = [...currentCat];
        skillsToAdd.forEach(s => {
          if (!newCat.includes(s)) {
            newCat.push(s);
          }
        });
        return {
          ...prev,
          skills: {
            ...skillsObj,
            [category]: newCat
          }
        };
      });
      setNewSkillsInput(prev => ({ ...prev, [category]: '' }));
    }
  };

  const handleRemoveSkill = (category, skillToRemove) => {
    setProfile(prev => {
      const skillsObj = prev.skills || {};
      const currentCat = skillsObj[category] || [];
      return {
        ...prev,
        skills: {
          ...skillsObj,
          [category]: currentCat.filter(s => s !== skillToRemove)
        }
      };
    });
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

        <button
          onClick={() => setActiveTab('projects')}
          style={{
            display: 'flex', alignItems: 'center', width: '100%', border: 'none', borderRadius: '10px',
            padding: '12px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            background: activeTab === 'projects' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'projects' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.3s ease', textAlign: 'left'
          }}
        >
          <Folder size={18} style={{ marginRight: '10px' }} /> Projects ({profile.projects?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('additional')}
          style={{
            display: 'flex', alignItems: 'center', width: '100%', border: 'none', borderRadius: '10px',
            padding: '12px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            background: activeTab === 'additional' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'additional' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.3s ease', textAlign: 'left'
          }}
        >
          <Award size={18} style={{ marginRight: '10px' }} /> Achievements & Info
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
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>First Name</label>
                <input
                  type="text"
                  value={profile.firstName || ''}
                  onChange={(e) => handleBasicChange('firstName', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Last Name</label>
                <input
                  type="text"
                  value={profile.lastName || ''}
                  onChange={(e) => handleBasicChange('lastName', e.target.value)}
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
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Street Address</label>
                <input
                  type="text"
                  value={profile.address || ''}
                  onChange={(e) => handleBasicChange('address', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                  placeholder="e.g. 123 Main St, Apt 4B"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>City</label>
                <input
                  type="text"
                  value={profile.city || ''}
                  onChange={(e) => handleBasicChange('city', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                  placeholder="e.g. Bengaluru"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>State / Province</label>
                <input
                  type="text"
                  value={profile.state || ''}
                  onChange={(e) => handleBasicChange('state', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                  placeholder="e.g. Karnataka"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Pin Code / Postal Code</label>
                <input
                  type="text"
                  value={profile.pincode || ''}
                  onChange={(e) => handleBasicChange('pincode', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                  placeholder="e.g. 560001"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Country</label>
                <input
                  type="text"
                  value={profile.country || ''}
                  onChange={(e) => handleBasicChange('country', e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                  placeholder="e.g. India"
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
            </div>

            {/* Target Locations Tag Input */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>📍 Target Search Locations (Multiple)</label>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Add target location (e.g. Remote, San Francisco, New York)..."
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLocation(e);
                    }
                  }}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={handleAddLocation}
                  style={{
                    background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)',
                    border: '1px solid rgba(139, 92, 246, 0.3)', padding: '0 20px', borderRadius: '10px',
                    fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s ease'
                  }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', background: 'rgba(0, 0, 0, 0.1)', minHeight: '48px' }}>
                {profile.targetLocations?.length === 0 ? (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No locations added. Target locations are required for Indeed search.</span>
                ) : (
                  profile.targetLocations?.map((loc, index) => (
                    <span
                      key={index}
                      style={{
                        display: 'inline-flex', alignItems: 'center', background: 'rgba(139, 92, 246, 0.08)',
                        border: '1px solid rgba(139, 92, 246, 0.25)', padding: '4px 10px', borderRadius: '30px',
                        fontSize: '13px', fontWeight: '500', color: 'var(--text)'
                      }}
                    >
                      {loc}
                      <button
                        type="button"
                        onClick={() => handleRemoveLocation(loc)}
                        style={{
                          background: 'transparent', border: 'none', color: 'var(--text-muted)',
                          marginLeft: '8px', cursor: 'pointer', fontSize: '11px', display: 'flex',
                          alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Job Types & Work Modes Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              {/* Job Types */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>💼 Job Types (Select Multiple)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', padding: '16px', borderRadius: '12px' }}>
                  {AVAILABLE_JOB_TYPES.map(type => (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                      <input
                        type="checkbox"
                        checked={profile.jobTypes?.includes(type) || false}
                        onChange={(e) => handleCheckboxChange('jobTypes', type, e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              {/* Work Modes */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>🏢 Work Modes (Select Multiple)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', padding: '16px', borderRadius: '12px' }}>
                  {AVAILABLE_WORK_MODES.map(mode => (
                    <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                      <input
                        type="checkbox"
                        checked={profile.workModes?.includes(mode) || false}
                        onChange={(e) => handleCheckboxChange('workModes', mode, e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                      />
                      {mode}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>Professional Summary</label>
              <textarea
                value={profile.summary || ''}
                onChange={(e) => handleBasicChange('summary', e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* CTC / Compensation Details Textareas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>💸 Current CTC / Salary Details</label>
                <textarea
                  value={profile.currentCTC || ''}
                  onChange={(e) => handleBasicChange('currentCTC', e.target.value)}
                  placeholder="e.g. 10 LPA or 85,000 USD/Year"
                  rows={2}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', resize: 'none', fontFamily: 'inherit', fontSize: '14px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>💰 Expected CTC / Salary Details</label>
                <textarea
                  value={profile.expectedCTC || ''}
                  onChange={(e) => handleBasicChange('expectedCTC', e.target.value)}
                  placeholder="e.g. 12-14 LPA (Negotiable) or 100k USD"
                  rows={2}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', resize: 'none', fontFamily: 'inherit', fontSize: '14px' }}
                />
              </div>
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

            <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--primary)', marginBottom: '20px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>Skills & Technologies (Categorized)</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {[
                { key: 'languages', label: '💻 Programming Languages', placeholder: 'Add programming languages (comma separated, e.g. JavaScript, Python)...' },
                { key: 'frameworks', label: '📦 Frameworks, Libraries & Runtimes', placeholder: 'Add React, Node.js, Express, etc. (comma separated)...' },
                { key: 'databases', label: '🗄️ Databases & Caches', placeholder: 'Add PostgreSQL, MongoDB, Redis, etc. (comma separated)...' },
                { key: 'devops', label: '☁️ DevOps, Cloud & CI/CD', placeholder: 'Add Docker, AWS, Kubernetes, etc. (comma separated)...' },
                { key: 'tools', label: '🛠️ Tools & Others', placeholder: 'Add Git, JIRA, Postman, etc. (comma separated)...' }
              ].map(cat => (
                <div key={cat.key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{cat.label}</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                      type="text"
                      placeholder={cat.placeholder}
                      value={newSkillsInput[cat.key] || ''}
                      onChange={(e) => handleSkillsInputChange(cat.key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill(cat.key);
                        }
                      }}
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSkill(cat.key)}
                      style={{
                        background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)',
                        border: '1px solid rgba(139, 92, 246, 0.3)', padding: '0 16px', borderRadius: '8px',
                        fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s ease', fontSize: '13px'
                      }}
                    >
                      Add
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', background: 'rgba(0, 0, 0, 0.1)', minHeight: '44px' }}>
                    {(!profile.skills?.[cat.key] || profile.skills[cat.key].length === 0) ? (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No items added yet.</span>
                    ) : (
                      profile.skills[cat.key].map((item, index) => (
                        <span
                          key={index}
                          style={{
                            display: 'inline-flex', alignItems: 'center', background: 'rgba(139, 92, 246, 0.08)',
                            border: '1px solid rgba(139, 92, 246, 0.25)', padding: '4px 10px', borderRadius: '30px',
                            fontSize: '13px', fontWeight: '500', color: 'var(--text)'
                          }}
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(cat.key, item)}
                            style={{
                              background: 'transparent', border: 'none', color: 'var(--text-muted)',
                              marginLeft: '8px', cursor: 'pointer', fontSize: '11px', display: 'flex',
                              alignItems: 'center', justifyContent: 'center'
                            }}
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
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

        {/* 5. PROJECTS TAB */}
        {activeTab === 'projects' && (
          <div className="fade-in" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '800' }}>Projects</h3>
              <button
                type="button"
                onClick={handleAddProject}
                style={{
                  display: 'flex', alignItems: 'center', background: 'var(--primary)', color: '#fff',
                  border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s ease'
                }}
              >
                <Plus size={16} style={{ marginRight: '6px' }} /> Add Project
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {profile.projects?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>No projects listed. Click "Add Project" to add projects.</p>
              ) : (
                profile.projects?.map((proj, idx) => (
                  <div key={idx} className="fade-in" style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', background: 'rgba(255, 255, 255, 0.01)', position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveProject(idx)}
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
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Project Title</label>
                        <input
                          type="text"
                          value={proj.title || ''}
                          onChange={(e) => handleProjectChange(idx, 'title', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Role/Contribution</label>
                        <input
                          type="text"
                          value={proj.role || ''}
                          onChange={(e) => handleProjectChange(idx, 'role', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Technologies Used (comma separated)</label>
                        <input
                          type="text"
                          value={Array.isArray(proj.technologies) ? proj.technologies.join(', ') : proj.technologies || ''}
                          onChange={(e) => handleProjectChange(idx, 'technologies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          placeholder="e.g. React, Docker, Rust"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Project Link / GitHub</label>
                        <input
                          type="text"
                          value={proj.link || ''}
                          onChange={(e) => handleProjectChange(idx, 'link', e.target.value)}
                          placeholder="e.g. https://github.com/..."
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', fontSize: '14px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Project Description</label>
                      <textarea
                        value={proj.description || ''}
                        onChange={(e) => handleProjectChange(idx, 'description', e.target.value)}
                        rows={3}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', resize: 'vertical', fontSize: '13px', fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 6. ACHIEVEMENTS & ADDITIONAL TAB */}
        {activeTab === 'additional' && (
          <div className="fade-in" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Achievements & Additional Info</h3>
            
            {/* Key Achievements */}
            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>🏆 Key Achievements (Certifications, Awards, Milestones)</label>
              
              <form onSubmit={handleAddAchievement} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Add achievement or award (e.g. Certified AWS Developer, Hackathon Winner)..."
                  value={newAchievement}
                  onChange={(e) => setNewAchievement(e.target.value)}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
                <button
                  type="submit"
                  style={{
                    background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)',
                    border: '1px solid rgba(139, 92, 246, 0.3)', padding: '0 20px', borderRadius: '10px',
                    fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s ease'
                  }}
                >
                  Add
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: 'rgba(0, 0, 0, 0.1)' }}>
                {profile.keyAchievements?.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No achievements listed yet.</p>
                ) : (
                  profile.keyAchievements?.map((ach, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: '8px', fontSize: '14px' }}>
                      <span style={{ flex: 1 }}>🏆 {ach}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAchievement(ach)}
                        style={{
                          background: 'transparent', border: 'none', color: 'var(--text-muted)',
                          cursor: 'pointer', marginLeft: '12px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Additional Info Section */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>📁 Additional Information (Hobbies, Languages, Custom Sections)</label>
              <textarea
                value={profile.additionalInfo || ''}
                onChange={(e) => handleBasicChange('additionalInfo', e.target.value)}
                placeholder="Enter any other details you want to add beside your resume (e.g. Languages: English (Fluent), Spanish (Basic); Interests: Open Source, Blog writing)..."
                rows={6}
                style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontSize: '14px' }}
              />
            </div>
          </div>
        )}

        {/* Footer Navigation & Save Row */}
        <div style={{ marginTop: 'auto', paddingTop: '32px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Previous Button */}
          {activeTab !== 'basic' ? (
            <button
              type="button"
              onClick={handlePrev}
              style={{
                background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text)', border: '1px solid var(--border)',
                padding: '10px 20px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
              Previous
            </button>
          ) : (
            <div></div>
          )}

          {/* Next or Confirm & Save Button */}
          {activeTab !== 'additional' ? (
            <button
              type="button"
              onClick={handleNext}
              style={{
                background: 'var(--primary)', color: '#fff', border: 'none',
                padding: '12px 24px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'var(--primary)'}
            >
              Next
            </button>
          ) : (
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
          )}
        </div>

      </div>

    </div>
  );
}
