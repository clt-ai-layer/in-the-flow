import React, { useState, useEffect, useMemo } from 'react';
import { Save, FolderOpen, Plus, ShieldCheck, RotateCcw, AlertTriangle } from 'lucide-react';
import api from '../api';
import {
  DEFAULT_GROUPING_COLORS,
  deriveGroupingList,
  validateGroupingColorMap,
  getContrastRatio,
  hashGroupingColor,
  HEX_COLOR_REGEX,
} from '../utils/groupingColors';

export default function Settings({
  onRefresh,
  tasks = [],
  groupingColors,
  onGroupingColorsChange,
  theme = 'dark',
  onThemeChange,
}) {
  const [apiKey, setApiKey] = useState('');
  const [planningPath, setPlanningPath] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Project Creation State
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projColor, setProjColor] = useState('#3B82F6');
  const [isCreatingProj, setIsCreatingProj] = useState(false);
  const [projSuccess, setProjSuccess] = useState(false);

  // Grouping Colors Editor State
  const [groupingColorMap, setGroupingColorMap] = useState({ ...DEFAULT_GROUPING_COLORS });
  const [isSavingGrouping, setIsSavingGrouping] = useState(false);
  const [groupingSaveSuccess, setGroupingSaveSuccess] = useState(false);
  const [groupingSaveError, setGroupingSaveError] = useState('');

  const groupingNames = useMemo(() => deriveGroupingList(tasks), [tasks]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await api.settings.get();
        if (settings.gemini_api_key) setApiKey(settings.gemini_api_key);
        if (settings.planning_folder_path) setPlanningPath(settings.planning_folder_path);
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    }
    loadSettings();
  }, []);

  useEffect(() => {
    if (groupingColors) {
      setGroupingColorMap({ ...groupingColors });
    }
  }, [groupingColors]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.settings.update({
        gemini_api_key: apiKey,
        planning_folder_path: planningPath,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBrowseFolder = async () => {
    if (window.electronAPI && window.electronAPI.openDirectory) {
      const selectedPath = await window.electronAPI.openDirectory();
      if (selectedPath) {
        setPlanningPath(selectedPath);
      }
    } else {
      alert('Electron IPC bridge is not available. Please enter the directory path manually.');
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projName.trim()) return;

    setIsCreatingProj(true);
    setProjSuccess(false);
    try {
      await api.projects.create({
        name: projName,
        description: projDesc,
        color: projColor,
      });
      setProjName('');
      setProjDesc('');
      setProjColor('#3B82F6');
      setProjSuccess(true);
      setTimeout(() => setProjSuccess(false), 3000);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to create project: ' + err.message);
    } finally {
      setIsCreatingProj(false);
    }
  };

  const handleGroupingColorChange = (name, hex) => {
    setGroupingColorMap((prev) => ({ ...prev, [name]: hex }));
    setGroupingSaveError('');
  };

  const handleResetGroupingDefaults = () => {
    const resetMap = { ...DEFAULT_GROUPING_COLORS };
    for (const name of groupingNames) {
      if (!(name in resetMap)) {
        resetMap[name] = groupingColorMap[name] ?? DEFAULT_GROUPING_COLORS.General;
      }
    }
    setGroupingColorMap(resetMap);
    setGroupingSaveError('');
  };

  const handleSaveGroupingColors = async () => {
    setGroupingSaveError('');
    const invalid = validateGroupingColorMap(groupingColorMap);
    if (invalid) {
      setGroupingSaveError(`Invalid hex for: ${invalid.join(', ')}. Use #RRGGBB format.`);
      return;
    }

    setIsSavingGrouping(true);
    setGroupingSaveSuccess(false);
    try {
      await api.settings.update({
        task_grouping_colors: JSON.stringify(groupingColorMap),
      });
      onGroupingColorsChange?.({ ...groupingColorMap });
      setGroupingSaveSuccess(true);
      setTimeout(() => setGroupingSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setGroupingSaveError('Failed to save grouping colors: ' + err.message);
    } finally {
      setIsSavingGrouping(false);
    }
  };

  const getContrastWarning = (hex) => {
    if (!HEX_COLOR_REGEX.test(hex)) return null;
    const ratio = getContrastRatio(hex, '#ffffff');
    if (ratio < 3) {
      return 'Low contrast on light backgrounds';
    }
    return null;
  };

  const inputStyle = {
    padding: '10px',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
  };

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '700' }}>Workspace Settings</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Configure credentials, workspace pathing and custom projects</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px', alignItems: 'start' }}>

        {/* Left Panel: Configuration settings */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            System Settings
          </h3>

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>
                APPEARANCE
              </label>
              <div
                style={{
                  display: 'inline-flex',
                  padding: '4px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                {['dark', 'light'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onThemeChange?.(mode)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: theme === mode ? '600' : '500',
                      backgroundColor: theme === mode ? 'var(--nav-active-bg)' : 'transparent',
                      color: theme === mode ? 'var(--text-primary)' : 'var(--text-secondary)',
                      transition: 'var(--transition-smooth)',
                    }}
                  >
                    {mode === 'dark' ? 'Dark' : 'Light'}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Applies immediately and saves automatically — no need to press Save Configuration.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>
                GOOGLE GEMINI API KEY
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                style={{ ...inputStyle, width: '100%', padding: '12px' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Key is used for classification, sprint agenda planning, and ticket details enhancement.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>
                LOCAL PLANNING DIRECTORY
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={planningPath}
                  onChange={(e) => setPlanningPath(e.target.value)}
                  placeholder="Enter your local planning folder path..."
                  style={{ ...inputStyle, flex: 1, padding: '12px' }}
                />
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  <FolderOpen size={16} /> Browse
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  backgroundColor: 'var(--accent-cyan)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'var(--bg-primary)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>

              {saveSuccess && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--accent-green)' }}>
                  <ShieldCheck size={14} /> Settings Saved
                </span>
              )}
            </div>

          </form>
        </div>

        {/* Right Panel: Project creation */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            Create New Project
          </h3>

          <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                PROJECT NAME
              </label>
              <input
                type="text"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                placeholder="e.g., StoryWeaver"
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                DESCRIPTION
              </label>
              <textarea
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                placeholder="Describe project boundaries..."
                style={{
                  ...inputStyle,
                  width: '100%',
                  height: '80px',
                  resize: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                PROJECT BADGE COLOR
              </label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={projColor}
                  onChange={(e) => setProjColor(e.target.value)}
                  style={{
                    border: 'none',
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                />
                <input
                  type="text"
                  value={projColor}
                  onChange={(e) => setProjColor(e.target.value)}
                  style={{ ...inputStyle, flex: 1, padding: '8px 12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
              <button
                type="submit"
                disabled={isCreatingProj}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  backgroundColor: 'var(--accent-cyan)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'var(--bg-primary)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <Plus size={16} />
                {isCreatingProj ? 'Creating...' : 'Create Project'}
              </button>

              {projSuccess && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--accent-green)' }}>
                  <ShieldCheck size={14} /> Project Created
                </span>
              )}
            </div>

          </form>
        </div>

      </div>

      {/* Task Grouping Colors */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Task Grouping Colors</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '640px' }}>
              Assign colors to task groupings for Kanban card stripes and column headers.
              Unknown groupings receive a stable auto-assigned color until you save an override here.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetGroupingDefaults}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              flexShrink: 0,
            }}
          >
            <RotateCcw size={14} /> Reset to defaults
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {groupingNames.map((name) => {
            const hex = groupingColorMap[name] ?? DEFAULT_GROUPING_COLORS[name] ?? hashGroupingColor(name);
            const contrastWarning = getContrastWarning(hex);
            return (
              <div
                key={name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 48px 1fr auto',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(15, 23, 42, 0.25)',
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{name}</span>
                <input
                  type="color"
                  value={HEX_COLOR_REGEX.test(hex) ? hex : DEFAULT_GROUPING_COLORS.General}
                  onChange={(e) => handleGroupingColorChange(name, e.target.value)}
                  style={{
                    border: 'none',
                    width: '40px',
                    height: '36px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                />
                <input
                  type="text"
                  value={hex}
                  onChange={(e) => handleGroupingColorChange(name, e.target.value)}
                  placeholder="#RRGGBB"
                  style={{ ...inputStyle, padding: '8px 12px' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '24px',
                      borderRadius: '4px',
                      backgroundColor: HEX_COLOR_REGEX.test(hex) ? hex : DEFAULT_GROUPING_COLORS.General,
                      border: '1px solid var(--glass-border)',
                    }}
                    title="Light preview strip"
                  />
                  {contrastWarning && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--accent-yellow)' }}>
                      <AlertTriangle size={12} /> {contrastWarning}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={handleSaveGroupingColors}
            disabled={isSavingGrouping}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              backgroundColor: 'var(--accent-cyan)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--bg-primary)',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            <Save size={16} />
            {isSavingGrouping ? 'Saving...' : 'Save Grouping Colors'}
          </button>

          {groupingSaveSuccess && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--accent-green)' }}>
              <ShieldCheck size={14} /> Grouping Colors Saved
            </span>
          )}

          {groupingSaveError && (
            <span style={{ fontSize: '12px', color: 'var(--accent-red)' }}>{groupingSaveError}</span>
          )}
        </div>
      </div>

    </div>
  );
}
