import React, { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, Clock, Trash2, Save, Copy, CalendarPlus, CalendarDays } from 'lucide-react';
import api from '../api';
import {
  SLOT_MINUTES,
  formatLocalDate,
  formatMinutesToTime,
} from '../pages/Calendar';

function sortBlocks(blocks) {
  return [...blocks].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.start_time.localeCompare(b.start_time);
  });
}

function getNextSlotDefaults() {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = Math.ceil((nowMinutes + 1) / SLOT_MINUTES) * SLOT_MINUTES;
  const endMinutes = Math.min(startMinutes + 60, 23 * 60 + 59);
  return {
    date: formatLocalDate(now),
    start_time: formatMinutesToTime(startMinutes),
    end_time: formatMinutesToTime(endMinutes),
    title: '',
  };
}

export default function TaskModal({
  task,
  projects,
  onClose,
  onSave,
  onDelete,
  onNavigateToCalendar,
  onDailyTasksChange,
}) {
  const [name, setName] = useState(task?.name || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'backlog');
  const [category, setCategory] = useState(task?.category || 'business');
  const [projectId, setProjectId] = useState(task?.project_id || '');
  const [owner, setOwner] = useState(task?.owner || 'Alice');
  const [taskGrouping, setTaskGrouping] = useState(task?.task_grouping || 'General');
  const [archived, setArchived] = useState(task?.archived || false);
  const [estimated, setEstimated] = useState(task?.estimated_duration || 0);
  const [current, setCurrent] = useState(task?.current_duration || 0);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const [scheduledBlocks, setScheduledBlocks] = useState([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(getNextSlotDefaults);
  const [isSavingBlock, setIsSavingBlock] = useState(false);
  const [lastSavedDate, setLastSavedDate] = useState(null);

  const refreshScheduledBlocks = useCallback(async (taskId) => {
    const data = await api.dailyTasks.list({ task_id: taskId });
    setScheduledBlocks(sortBlocks(data));
  }, []);

  // Sync state if task changes
  useEffect(() => {
    if (task) {
      setName(task.name);
      setDescription(task.description || '');
      setStatus(task.status);
      setCategory(task.category);
      setProjectId(task.project_id || '');
      setOwner(task.owner || 'Alice');
      setTaskGrouping(task.task_grouping || 'General');
      setArchived(task.archived || false);
      setEstimated(task.estimated_duration || 0);
      setCurrent(task.current_duration || 0);
    }
  }, [task]);

  useEffect(() => {
    if (!task?.id) {
      setScheduledBlocks([]);
      setShowAddForm(false);
      setLastSavedDate(null);
      return;
    }

    let cancelled = false;
    async function loadBlocks() {
      setBlocksLoading(true);
      try {
        const data = await api.dailyTasks.list({ task_id: task.id });
        if (!cancelled) {
          setScheduledBlocks(sortBlocks(data));
        }
      } catch (e) {
        console.error('Failed to load scheduled blocks', e);
      } finally {
        if (!cancelled) setBlocksLoading(false);
      }
    }
    loadBlocks();
    return () => { cancelled = true; };
  }, [task?.id]);

  const handleDeleteBlock = async (e, blockId) => {
    e.stopPropagation();
    if (!confirm('Delete this scheduled block?')) return;
    try {
      await api.dailyTasks.delete(blockId);
      setScheduledBlocks((prev) => prev.filter((b) => b.id !== blockId));
      onDailyTasksChange?.();
    } catch (err) {
      console.error(err);
      alert('Failed to delete scheduled block.');
    }
  };

  const handleBlockRowClick = (block) => {
    onNavigateToCalendar?.(block.date);
  };

  const handleAddToCalendarClick = () => {
    setAddForm(getNextSlotDefaults());
    setShowAddForm(true);
    setLastSavedDate(null);
  };

  const handleSaveAddForm = async () => {
    if (!task?.id) return;
    setIsSavingBlock(true);
    try {
      await api.dailyTasks.create({
        task_id: task.id,
        date: addForm.date,
        start_time: addForm.start_time,
        end_time: addForm.end_time,
        title: addForm.title.trim() || null,
      });
      await refreshScheduledBlocks(task.id);
      onDailyTasksChange?.();
      setShowAddForm(false);
      setLastSavedDate(addForm.date);
    } catch (e) {
      console.error(e);
      alert(`Failed to add to calendar: ${e.message}`);
    } finally {
      setIsSavingBlock(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...task,
      name,
      description,
      status,
      category,
      project_id: projectId || null,
      owner,
      task_grouping: taskGrouping,
      archived,
      estimated_duration: Number(estimated) || null,
      current_duration: Number(current) || 0
    });
  };

  const handleDuplicate = () => {
    if (!name.trim()) return;
    onSave({
      name: `${name} (Copy)`,
      description,
      status,
      category,
      project_id: projectId || null,
      owner,
      task_grouping: taskGrouping,
      archived: false,
      estimated_duration: Number(estimated) || null,
      current_duration: Number(current) || 0
    });
  };

  const handleEnhance = async () => {
    if (!name.trim()) return;
    setIsEnhancing(true);
    try {
      const result = await api.ai.enhanceTicket({
        name,
        description_stub: description
      });
      if (result.enhanced_description_markdown) {
        setDescription(result.enhanced_description_markdown);
      }
    } catch (e) {
      console.error(e);
      alert('Error calling Gemini AI: ' + e.message);
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--modal-overlay)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid var(--glass-border)'
          }}
        >
          <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {task?.id ? 'Edit Ticket' : 'Create New Ticket'}
          </h3>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '24px' }}>
          
          {/* Left Column: Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>TASK TITLE</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="e.g., Verify Zod schemas validation"
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>TICKET DESCRIPTION (MARKDOWN)</label>
                <button
                  type="button"
                  onClick={handleEnhance}
                  disabled={isEnhancing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    opacity: isEnhancing ? 0.6 : 1
                  }}
                >
                  <Sparkles size={12} />
                  {isEnhancing ? 'AI Enhancing...' : 'AI Enhance'}
                </button>
              </div>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write ticket goals, preconditions, and requirements..."
                style={{
                  width: '100%',
                  height: '320px',
                  padding: '12px',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>
          </div>

          {/* Right Column: Parameters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '12px', borderLeft: '1px solid var(--glass-border)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>STATUS</label>
              <select 
                value={status} 
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              >
                <option value="backlog">Backlog</option>
                <option value="ready_to_start">Ready to Start</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="done">Done</option>
              </select>
              
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="archived-checkbox"
                  checked={archived} 
                  onChange={(e) => setArchived(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--accent-cyan)',
                    cursor: 'pointer'
                  }}
                />
                <label htmlFor="archived-checkbox" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
                  Archived (Hidden from board)
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>CATEGORY</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              >
                <option value="business">Business</option>
                <option value="dev">Technical / Dev</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>PROJECT</label>
              <select 
                value={projectId} 
                onChange={(e) => setProjectId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              >
                <option value="">No Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>OWNER</label>
              <select 
                value={owner} 
                onChange={(e) => setOwner(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              >
                <option value="Alice">Alice</option>
                <option value="Bob">Bob</option>
                <option value="Shared">Shared</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>TASK GROUPING</label>
              <input 
                type="text" 
                value={taskGrouping} 
                onChange={(e) => setTaskGrouping(e.target.value)} 
                placeholder="e.g. Backend"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                ESTIMATED TIME (MINUTES)
              </label>
              <input 
                type="number" 
                value={estimated} 
                onChange={(e) => setEstimated(e.target.value)} 
                min="0"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                INVESTED TIME (MINUTES)
              </label>
              <input 
                type="number" 
                value={current} 
                onChange={(e) => setCurrent(e.target.value)} 
                min="0"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            {task?.id && (
              <div style={{ marginTop: '4px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>
                  <CalendarDays size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  SCHEDULED BLOCKS
                </label>

                {blocksLoading ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '8px 0' }}>
                    Loading schedule…
                  </div>
                ) : scheduledBlocks.length === 0 ? (
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    padding: '10px',
                    backgroundColor: 'var(--input-bg)',
                    borderRadius: '6px',
                    border: '1px dashed var(--glass-border)',
                  }}>
                    No scheduled blocks. Use Add to calendar below.
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: '160px',
                    overflowY: 'auto',
                  }}>
                    {scheduledBlocks.map((block) => (
                      <div
                        key={block.id}
                        onClick={() => handleBlockRowClick(block)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 10px',
                          backgroundColor: 'var(--input-bg)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                        className="interactive"
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                            {block.date}
                          </div>
                          <div style={{ color: 'var(--text-secondary)' }}>
                            {block.start_time} – {block.end_time}
                            {' · '}
                            {block.title || name || block.parent_task_name || 'Untitled'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteBlock(e, block.id)}
                          title="Delete block"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-red)',
                            cursor: 'pointer',
                            padding: '4px',
                            flexShrink: 0,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showAddForm ? (
                  <div style={{
                    marginTop: '10px',
                    padding: '12px',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Date</label>
                      <input
                        type="date"
                        value={addForm.date}
                        onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '4px',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Start</label>
                        <input
                          type="time"
                          value={addForm.start_time}
                          step={SLOT_MINUTES * 60}
                          onChange={(e) => setAddForm((f) => ({ ...f, start_time: e.target.value.slice(0, 5) }))}
                          style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>End</label>
                        <input
                          type="time"
                          value={addForm.end_time}
                          step={SLOT_MINUTES * 60}
                          onChange={(e) => setAddForm((f) => ({ ...f, end_time: e.target.value.slice(0, 5) }))}
                          style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Title (optional — inherits task name)
                      </label>
                      <input
                        type="text"
                        value={addForm.title}
                        onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder={name || 'Task title'}
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '4px',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '4px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAddForm}
                        disabled={isSavingBlock}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'var(--accent-cyan)',
                          border: 'none',
                          borderRadius: '4px',
                          color: 'var(--bg-primary)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          opacity: isSavingBlock ? 0.6 : 1,
                        }}
                      >
                        {isSavingBlock ? 'Saving…' : 'Save block'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddToCalendarClick}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '100%',
                      marginTop: '10px',
                      padding: '8px 12px',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--accent-cyan)',
                      borderRadius: '6px',
                      color: 'var(--accent-cyan)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                    }}
                    className="interactive"
                  >
                    <CalendarPlus size={14} />
                    Add to calendar
                  </button>
                )}

                {lastSavedDate && !showAddForm && (
                  <button
                    type="button"
                    onClick={() => onNavigateToCalendar?.(lastSavedDate)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '100%',
                      marginTop: '8px',
                      padding: '6px 12px',
                      backgroundColor: 'var(--nav-active-bg)',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                    className="interactive"
                  >
                    <CalendarDays size={14} />
                    Open in Calendar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderTop: '1px solid var(--glass-border)',
            background: 'var(--input-bg)'
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            {task?.id && (
              <>
                <button 
                  onClick={() => {
                    if (confirm('Delete this ticket permanently?')) {
                      onDelete(task.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--accent-red)',
                    borderRadius: '6px',
                    color: 'var(--accent-red)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                >
                  <Trash2 size={14} />
                  Delete Ticket
                </button>
                <button 
                  onClick={handleDuplicate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--accent-purple)',
                    borderRadius: '6px',
                    color: 'var(--accent-purple)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                  className="interactive"
                >
                  <Copy size={14} />
                  Duplicate
                </button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: '1px solid var(--glass-border)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                backgroundColor: 'var(--accent-cyan)',
                border: 'none',
                borderRadius: '6px',
                color: 'var(--bg-primary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              <Save size={14} />
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
