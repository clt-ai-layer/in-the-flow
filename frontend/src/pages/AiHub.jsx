import React, { useState } from 'react';
import { Sparkles, Calendar, HeartCrack, ChevronRight, CheckCircle2, SplitSquareVertical } from 'lucide-react';
import api from '../api';

export default function AiHub({ onRefresh }) {
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [isCompilingPlan, setIsCompilingPlan] = useState(false);

  const [diagnostics, setDiagnostics] = useState(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const handleCompilePlan = async () => {
    setIsCompilingPlan(true);
    try {
      const result = await api.ai.weeklyPlan();
      setWeeklyPlan(result);
    } catch (e) {
      console.error(e);
      alert('Error compiling weekly plan: ' + e.message);
    } finally {
      setIsCompilingPlan(false);
    }
  };

  const handleDiagnoseFlow = async () => {
    setIsDiagnosing(true);
    try {
      const result = await api.ai.flowAnalyzer();
      setDiagnostics(result);
    } catch (e) {
      console.error(e);
      alert('Error diagnosing flow: ' + e.message);
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '700' }}>AI Flow Hub</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Optimize your workspace alignment and blockers with Google Gemini</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '28px', alignItems: 'start' }}>
        
        {/* Left Side: Weekly Sprint Planner */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: 'var(--accent-cyan)' }} />
              Weekly Planning Compiler
            </h3>
            <button
              onClick={handleCompilePlan}
              disabled={isCompilingPlan}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px'
              }}
            >
              <Sparkles size={13} />
              {isCompilingPlan ? 'Compiling...' : 'Compile Sprint Plan'}
            </button>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Gemini will scan local planning markdown files in your `Documentation` folder to extract priorities and output a suggested calendar schedule.
          </p>

          {weeklyPlan ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
              {/* Summary */}
              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                <h4 style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: '700', marginBottom: '6px' }}>SPRINT STRATEGY</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                  {weeklyPlan.week_summary}
                </p>
              </div>

              {/* Day Calendar */}
              <div>
                <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '12px' }}>SUGGESTED DAILY AGENDA</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {weeklyPlan.suggested_calendar?.map((day, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(15, 23, 42, 0.2)',
                        borderLeft: '3px solid var(--accent-cyan)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{day.day}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px' }}>
                        {day.tasks.map((task, tIdx) => (
                          <div key={tIdx} style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} />
                            {task}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ border: '1px dashed var(--glass-border)', padding: '60px 0', textAlign: 'center', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Click "Compile Sprint Plan" to parse documentation workspace.
            </div>
          )}
        </div>

        {/* Right Side: Flow State Blocker Diagnostics */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HeartCrack size={18} style={{ color: 'var(--accent-red)' }} />
              Flow Friction Diagnostics
            </h3>
            <button
              onClick={handleDiagnoseFlow}
              disabled={isDiagnosing}
              style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--accent-red)',
                borderRadius: '6px',
                color: 'var(--accent-red)',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px'
              }}
            >
              {isDiagnosing ? 'Analyzing...' : 'Diagnose Blockers'}
            </button>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Gemini will scan active tickets, identify tasks stuck in "On Hold" or running over estimations, and output diagnostic advice.
          </p>

          {diagnostics ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
              {/* Score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Overall Friction Score:</span>
                <span 
                  style={{ 
                    fontSize: '24px', 
                    fontWeight: '700', 
                    color: diagnostics.friction_score > 60 ? 'var(--accent-red)' : 
                           diagnostics.friction_score > 30 ? 'var(--accent-yellow)' : 'var(--accent-green)' 
                  }}
                >
                  {diagnostics.friction_score}%
                </span>
              </div>

              {/* Blocked tasks list */}
              {diagnostics.identified_blockers?.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' }}>IDENTIFIED BLOCKERS</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {diagnostics.identified_blockers.map((b, idx) => (
                      <div key={idx} style={{ padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                        <h5 style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '2px' }}>{b.task_name}</h5>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{b.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remediation Advice */}
              {diagnostics.reremediation_actions?.length > 0 || diagnostics.remediation_actions?.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' }}>REMEDIATION STEPS</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(diagnostics.remediation_actions || []).map((step, idx) => (
                      <div key={idx} style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={12} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Split recommendations */}
              {diagnostics.split_recommendations?.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' }}>TICKET SPLIT SUGGESTIONS</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {diagnostics.split_recommendations.map((split, idx) => (
                      <div key={idx} style={{ padding: '12px', backgroundColor: 'rgba(6, 182, 212, 0.04)', borderRadius: '6px', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          <SplitSquareVertical size={12} />
                          {split.original_task}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '10px' }}>
                          {split.sub_tasks.map((st, sIdx) => (
                            <div key={sIdx} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>• {st}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div style={{ border: '1px dashed var(--glass-border)', padding: '60px 0', textAlign: 'center', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Click "Diagnose Blockers" to scan current task delays.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
