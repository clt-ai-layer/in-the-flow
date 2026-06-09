import React, { useState, useEffect } from 'react';
import { Play, Square, Award, Clock, Activity, Sparkles, CheckCircle2 } from 'lucide-react';
import api from '../api';

export default function Dashboard({ tasks, projects, onRefresh, onEditTask }) {
  const [activeTask, setActiveTask] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerIntervalId, setTimerIntervalId] = useState(null);
  const [frictionScore, setFrictionScore] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState("Loading flow recommendation...");

  // Calculations
  const completedTasks = tasks.filter(t => t.status === 'done');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.current_duration || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  // Fetch AI diagnostics on load
  useEffect(() => {
    async function loadDiagnostics() {
      try {
        const diagnostics = await api.ai.flowAnalyzer();
        setFrictionScore(diagnostics.friction_score);
        if (diagnostics.remediation_actions && diagnostics.remediation_actions.length > 0) {
          setAiSuggestion(diagnostics.remediation_actions[0]);
        } else {
          setAiSuggestion("All systems nominal. Ready to enter flow state.");
        }
      } catch (e) {
        setFrictionScore(12);
        setAiSuggestion("Keep focused on high-priority developer tasks.");
      }
    }
    if (tasks.length > 0) {
      loadDiagnostics();
    }
  }, [tasks]);

  // Timer lifecycle
  useEffect(() => {
    return () => {
      if (timerIntervalId) clearInterval(timerIntervalId);
    };
  }, [timerIntervalId]);

  const startTracking = (task) => {
    if (timerIntervalId) clearInterval(timerIntervalId);
    
    setActiveTask(task);
    setTimerSeconds(0);
    
    const interval = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
    
    setTimerIntervalId(interval);
  };

  const stopTracking = async () => {
    if (!activeTask || !timerIntervalId) return;
    
    clearInterval(timerIntervalId);
    setTimerIntervalId(null);
    
    const minutesTracked = Math.round(timerSeconds / 60) || 1;
    const updatedDuration = (activeTask.current_duration || 0) + minutesTracked;
    
    try {
      await api.tasks.update(activeTask.id, {
        ...activeTask,
        current_duration: updatedDuration
      });
      onRefresh();
    } catch (e) {
      console.error("Failed to update active task duration", e);
    }
    
    setActiveTask(null);
    setTimerSeconds(0);
  };

  const getFrictionColor = (score) => {
    if (score === null) return 'var(--text-secondary)';
    if (score < 30) return 'var(--accent-green)';
    if (score < 60) return 'var(--accent-yellow)';
    return 'var(--accent-red)';
  };

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: '700' }}>Productivity Hub</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Welcome back. Let's get things done.</p>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-green)' }}>
            <Award size={24} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '700' }}>{completedTasks.length}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>TASKS COMPLETED</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-cyan)' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '700' }}>{totalHours} hrs</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>FOCUS INVESTED</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-purple)' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '700' }}>{frictionScore !== null ? `${frictionScore}%` : 'Low'}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>FRICTION SCORE</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(217, 119, 6, 0.1)', color: 'var(--accent-yellow)' }}>
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '700' }}>{projects.length}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>ACTIVE PROJECTS</div>
          </div>
        </div>
      </div>

      {/* Active Session Tracker */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '24px', 
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(8, 47, 73, 0.4))',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          border: '1px solid rgba(6, 182, 212, 0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div 
            style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: activeTask ? 'var(--accent-cyan)' : 'var(--text-muted)',
              boxShadow: activeTask ? '0 0 10px var(--accent-cyan)' : 'none',
              animation: activeTask ? 'pulse 2s infinite' : 'none'
            }} 
          />
          <div>
            <h4 style={{ fontSize: '15px', color: activeTask ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {activeTask ? `Currently Tracking: ${activeTask.name}` : 'No Active Session'}
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {activeTask ? 'Keep focusing. Your time is being logged.' : 'Select a task from below to start a focus timer.'}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontSize: '24px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>
            {Math.floor(timerSeconds / 60).toString().padStart(2, '0')}:{(timerSeconds % 60).toString().padStart(2, '0')}
          </div>
          {activeTask ? (
            <button 
              onClick={stopTracking}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--accent-red)',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Square size={14} /> Stop Session
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Grid split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '28px', flex: 1, minHeight: '300px' }}>
        
        {/* Left Side: Tasks In Progress */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--text-primary)' }}>Active Work Items</h3>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {inProgressTasks.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                No tasks are currently set to "In Progress".
              </div>
            ) : (
              inProgressTasks.map((t) => {
                const project = projects.find(p => p.id === t.project_id);
                return (
                  <div 
                    key={t.id} 
                    style={{
                      padding: '14px 18px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.3)',
                      border: '1px solid var(--glass-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span 
                          style={{
                            fontSize: '10px',
                            fontWeight: '600',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: project ? `${project.color}20` : 'rgba(255,255,255,0.1)',
                            color: project ? project.color : 'var(--text-secondary)'
                          }}
                        >
                          {project ? project.name : 'Unassigned'}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t.category.toUpperCase()}</span>
                      </div>
                      <h4 
                        onClick={() => onEditTask(t)}
                        style={{ fontSize: '14px', cursor: 'pointer', hover: { color: 'var(--accent-cyan)' } }}
                      >
                        {t.name}
                      </h4>
                    </div>

                    <button 
                      onClick={() => startTracking(t)}
                      disabled={!!activeTask}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-cyan)',
                        cursor: 'pointer',
                        opacity: activeTask ? 0.3 : 1
                      }}
                    >
                      <Play size={18} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Flow Assistant Diagnosis */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} style={{ color: 'var(--accent-cyan)' }} />
            Flow Assistant
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>CURRENT FRICTION STATE</label>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '32px', fontWeight: '700', color: getFrictionColor(frictionScore) }}>
                  {frictionScore !== null ? `${frictionScore}%` : 'LOW'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {frictionScore > 50 ? 'Friction detected' : 'Clear flow path'}
                </span>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
              <label style={{ fontSize: '11px', color: 'var(--accent-purple)', fontWeight: '700', display: 'block', marginBottom: '6px' }}>AI RECOMMENDATION</label>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                "{aiSuggestion}"
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
