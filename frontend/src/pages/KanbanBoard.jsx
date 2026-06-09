import React, { useState } from 'react';
import { Plus, AlertCircle, ChevronDown, ChevronRight, Eye, Edit3, Trash2, Copy } from 'lucide-react';
import api from '../api';
import ViewControlBar from '../components/ViewControlBar';
import {
  getGroupingColor,
  getTaskGrouping,
  getContrastTextColor,
  getGroupingCardChromeStyle,
  hexToRgba,
  DEFAULT_GROUPING_COLORS,
} from '../utils/groupingColors';

/** Locate a task record in grouped or flat view execute results. */
function findRecordInViewResult(viewResult, taskId) {
  if (!viewResult || !taskId) return null;
  if (Array.isArray(viewResult.records)) {
    const flat = viewResult.records.find((r) => r.id === taskId);
    if (flat) return flat;
  }
  const groups = viewResult.groups;
  if (!groups) return null;
  for (const colKey of Object.keys(groups)) {
    const colData = groups[colKey];
    if (Array.isArray(colData)) {
      const found = colData.find((r) => r.id === taskId);
      if (found) return found;
    } else if (colData && typeof colData === 'object') {
      for (const rowKey of Object.keys(colData)) {
        const found = (colData[rowKey] || []).find((r) => r.id === taskId);
        if (found) return found;
      }
    }
  }
  return null;
}

/** Map view record or REST task to a consistent edit/duplicate shape. */
function normalizeTaskShape(source) {
  if (!source) return null;
  return {
    id: source.id,
    name: source.name || source.Name,
    description: source.description || source.Description || '',
    status: source.status || source.Status || 'backlog',
    category: source.category || source.Category || 'business',
    owner: source.owner || source.Owner || 'Alice',
    task_grouping: getTaskGrouping(source),
    estimated_duration: Number(source.estimated_duration ?? source['Estimated Duration']) || null,
    current_duration: Number(source.current_duration ?? source['Current Duration']) || 0,
    source: source.source || source.Source || 'user_created',
    project_id: source.project_id || (source.Project && source.Project[0]) || null,
  };
}

const STATUS_COLUMNS = [
  { id: 'backlog', title: 'Backlog', color: 'hsl(220, 10%, 60%)' },
  { id: 'ready_to_start', title: 'Ready to Start', color: 'var(--accent-cyan)' },
  { id: 'in_progress', title: 'In Progress', color: 'var(--accent-purple)' },
  { id: 'on_hold', title: 'On Hold', color: 'var(--accent-yellow)' },
  { id: 'done', title: 'Done', color: 'var(--accent-green)' }
];

export default function KanbanBoard({ 
  tasks, 
  projects, 
  groupingColors = DEFAULT_GROUPING_COLORS,
  onRefresh, 
  onEditTask, 
  onCreateTask,
  activeView,
  properties,
  viewResult,
  onUpdateConfig,
  onDeleteView
}) {
  // Track which swimlane rows are collapsed
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState({});
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [contextMenu, setContextMenu] = useState(null); // { x: number, y: number, task: object }

  const isTaskGroupingGroupBy = (field) => {
    const lower = (field || '').toLowerCase().replace(/\s+/g, '');
    return lower === 'taskgrouping';
  };

  const cardChromeStyle = (taskOrRec) =>
    getGroupingCardChromeStyle(getTaskGrouping(taskOrRec), groupingColors);

  const handleDuplicateTask = async (task) => {
    try {
      await api.tasks.create({
        name: `${task.name || task.Name} (Copy)`,
        description: task.description || task.Description || '',
        status: task.status || task.Status || 'backlog',
        category: task.category || task.Category || 'business',
        project_id: task.project_id || (task.Project && task.Project[0]) || null,
        owner: task.owner || task.Owner || 'Alice',
        task_grouping: task.task_grouping || task.TaskGrouping || 'General',
        estimated_duration: Number(task.estimated_duration || task['Estimated Duration']) || null,
        current_duration: Number(task.current_duration || task['Current Duration']) || 0
      });
      onRefresh();
    } catch (e) {
      console.error(e);
      alert('Failed to duplicate task: ' + e.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await api.tasks.delete(taskId);
      onRefresh();
    } catch (e) {
      console.error(e);
      alert('Failed to delete task: ' + e.message);
    }
  };

  const filterTask = (task) => {
    // Hide archived
    const isArchived = task.Archived === true || task.Archived === 'true' || task.archived === true;
    if (isArchived) return false;

    // Filter by category
    const cat = task.Category || task.category || '';
    if (categoryFilter === 'dev' && cat !== 'dev') return false;
    if (categoryFilter === 'business' && cat !== 'business') return false;
    // categoryFilter === 'all' → no category exclusion

    // Filter by owner
    const own = task.Owner || task.owner || '';
    if (ownerFilter === 'Alice' && own !== 'Alice' && own !== 'Shared') return false;
    if (ownerFilter === 'Bob' && own !== 'Bob' && own !== 'Shared') return false;

    return true;
  };

  const renderFilters = () => {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px', 
        padding: '0 24px 16px 24px', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        flexShrink: 0 
      }}>
        {/* Category Tabs: Technical / Business */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', width: '80px', fontWeight: '700' }}>Category:</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'all', label: '📋 All' },
              { id: 'dev', label: '💻 Technical' },
              { id: 'business', label: '📈 Business' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '20px',
                  border: '1px solid var(--glass-border)',
                  background: categoryFilter === tab.id ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.03)',
                  color: categoryFilter === tab.id ? 'var(--bg-primary)' : 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
                className="interactive"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Owner Tabs: Alice / Bob / All */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', width: '80px', fontWeight: '700' }}>Owner:</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'Alice', label: 'Ⓐ Alice' },
              { id: 'Bob', label: '🅱️ Bob' },
              { id: 'all', label: '🤝 All Owners' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setOwnerFilter(tab.id)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '20px',
                  border: '1px solid var(--glass-border)',
                  background: ownerFilter === tab.id ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.03)',
                  color: ownerFilter === tab.id ? 'white' : 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
                className="interactive"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const toggleSwimlane = (laneId) => {
    setCollapsedSwimlanes(prev => ({
      ...prev,
      [laneId]: !prev[laneId]
    }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = async (e, targetColId, targetRowId = null) => {
    const taskId = e.dataTransfer.getData('taskId');

    let task =
      tasks.find((t) => t.id === taskId) ||
      findRecordInViewResult(viewResult, taskId);

    if (!task) return;

    const normalized = normalizeTaskShape(task);
    const groupByField = viewResult?.group_by || 'Status';
    const subgroupByField = viewResult?.subgroup_by;
    const colValue = targetColId === 'None' ? 'General' : targetColId;

    let status = normalized.status;
    let taskGrouping = normalized.task_grouping;
    let projectId = normalized.project_id;

    if (groupByField.toLowerCase() === 'status') {
      status = targetColId;
    } else if (isTaskGroupingGroupBy(groupByField)) {
      taskGrouping = colValue;
    } else if (groupByField.toLowerCase() === 'project') {
      projectId = targetColId === 'None' ? null : targetColId;
    }

    if (subgroupByField && targetRowId !== null) {
      const rowVal = targetRowId === 'None' ? null : targetRowId;
      if (subgroupByField.toLowerCase() === 'project') {
        projectId = rowVal;
      } else if (isTaskGroupingGroupBy(subgroupByField)) {
        taskGrouping = targetRowId === 'None' ? 'General' : targetRowId;
      }
    }

    try {
      await api.tasks.update(taskId, {
        id: taskId,
        name: normalized.name,
        description: normalized.description,
        status,
        category: normalized.category,
        owner: normalized.owner,
        task_grouping: taskGrouping,
        project_id: projectId,
        estimated_duration: parseInt(normalized.estimated_duration || 60, 10),
        current_duration: parseInt(normalized.current_duration || 0, 10),
        source: normalized.source,
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to update task properties on drop', err);
    }
  };

  // 1. Dynamic Relational Mode Render
  if (viewResult && viewResult.grouped) {
    const groupByField = viewResult.group_by;
    const subgroupByField = viewResult.subgroup_by;
    const groups = viewResult.groups || {};

    // Determine the columns to render
    // If grouping by status, use standard sorted columns, otherwise extract keys
    let columns = [];
    const isTaskGrouping = isTaskGroupingGroupBy(groupByField);
    const isTaskGroupingSubgroup = isTaskGroupingGroupBy(subgroupByField);
    if (groupByField.toLowerCase() === 'status') {
      columns = STATUS_COLUMNS;
    } else {
      const uniqueKeys = new Set(Object.keys(groups));
      if (uniqueKeys.size === 0) uniqueKeys.add('None');
      columns = Array.from(uniqueKeys).map(k => ({
        id: k,
        title: k === 'None' ? 'Unassigned' : k,
        color: isTaskGrouping
          ? getGroupingColor(k === 'None' ? 'General' : k, groupingColors)
          : 'var(--accent-cyan)'
      }));
    }

    // Determine swimlanes (rows)
    let swimlanes = ['Default'];
    if (subgroupByField) {
      const allRowKeys = new Set();
      Object.keys(groups).forEach(colKey => {
        const subgroup = groups[colKey];
        if (subgroup && typeof subgroup === 'object' && !Array.isArray(subgroup)) {
          Object.keys(subgroup).forEach(rowKey => {
            allRowKeys.add(rowKey);
          });
        }
      });
      swimlanes = Array.from(allRowKeys);
      // Sort so 'None' or empty is last
      swimlanes.sort((a, b) => {
        if (a === 'None' || a === '') return 1;
        if (b === 'None' || b === '') return -1;
        return a.localeCompare(b);
      });
      if (swimlanes.length === 0) swimlanes = ['None'];
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Dynamic Controls Bar */}
        <ViewControlBar 
          activeView={activeView}
          properties={properties}
          onUpdateConfig={onUpdateConfig}
          onDeleteView={onDeleteView}
          onCreateTask={onCreateTask}
        />

        {/* Unified Category & Owner Tabs */}
        {renderFilters()}

        {/* Board View Layout */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Header Row showing column names */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: '16px', flexShrink: 0 }}>
            {columns.map(col => {
              const headerBg = isTaskGrouping ? hexToRgba(col.color, 0.2) : undefined;
              const headerTextColor = isTaskGrouping ? getContrastTextColor(col.color) : 'var(--text-primary)';
              return (
                <div
                  key={col.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    paddingBottom: '8px',
                    padding: isTaskGrouping ? '8px 10px' : '0 0 8px 0',
                    borderBottom: '2px solid rgba(255,255,255,0.05)',
                    backgroundColor: headerBg,
                    borderRadius: isTaskGrouping ? '6px' : undefined,
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.color || 'var(--accent-cyan)' }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: headerTextColor }}>{col.title}</span>
                </div>
              );
            })}
          </div>

          {/* Swimlane Blocks */}
          {swimlanes.map(lane => {
            const isCollapsed = collapsedSwimlanes[lane];
            const laneColor = isTaskGroupingSubgroup
              ? getGroupingColor(lane === 'None' || lane === '' ? 'General' : lane, groupingColors)
              : null;
            
            // Count total items in this lane
            let laneCount = 0;
            columns.forEach(col => {
              const colData = groups[col.id];
              if (colData) {
                const items = subgroupByField ? (colData[lane] || []) : (colData || []);
                laneCount += items.filter(filterTask).length;
              }
            });

            // Hide the subgroup entirely if it has no items (due to filters or emptiness)
            if (subgroupByField && laneCount === 0) {
              return null;
            }

            return (
              <div key={lane} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
                {/* Swimlane Header (Collapsible) */}
                {subgroupByField && (
                  <button
                    onClick={() => toggleSwimlane(lane)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: laneColor ? hexToRgba(laneColor, 0.12) : 'rgba(255,255,255,0.02)',
                      border: laneColor
                        ? `1px solid ${hexToRgba(laneColor, 0.35)}`
                        : '1px solid rgba(255,255,255,0.04)',
                      borderLeft: laneColor ? `4px solid ${laneColor}` : undefined,
                      color: laneColor ? getContrastTextColor(laneColor) : 'var(--text-secondary)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      textAlign: 'left',
                      outline: 'none',
                      width: 'fit-content'
                    }}
                    className="interactive"
                  >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span>{lane === 'None' || lane === '' ? 'General' : lane}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '10px' }}>
                      {laneCount}
                    </span>
                  </button>
                )}

                {/* Swimlane grid cells */}
                {!isCollapsed && (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: '16px' }}>
                    {columns.map(col => {
                      let colRecords = [];
                      const colData = groups[col.id];
                      
                      if (colData) {
                        if (subgroupByField) {
                          colRecords = colData[lane] || [];
                        } else {
                          colRecords = colData || [];
                        }
                      }
                      colRecords = colRecords.filter(filterTask);

                      return (
                        <div
                          key={col.id}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, col.id, lane)}
                          style={{
                            background: 'rgba(15, 23, 42, 0.15)',
                            border: '1px dashed rgba(255,255,255,0.04)',
                            borderRadius: '8px',
                            minHeight: '120px',
                            padding: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          {colRecords.map(rec => {
                            const remaining = rec['Remaining Duration'];
                            const est = rec['Estimated Duration'] || rec.estimated_duration || 0;
                            const logged = rec['Current Duration'] || rec.current_duration || 0;
                            const isOver = est > 0 && logged > est;
                            const grouping = getTaskGrouping(rec);
                            const groupingColor = getGroupingColor(grouping, groupingColors);
                            const normalizedRec = normalizeTaskShape(rec);

                            return (
                              <div
                                key={rec.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, rec.id)}
                                onClick={(e) => {
                                  if (e.button === 2) return;
                                  onEditTask(normalizedRec);
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    task: normalizedRec,
                                  });
                                }}
                                style={{
                                  padding: '12px',
                                  border: '1px solid',
                                  borderRadius: '8px',
                                  cursor: 'grab',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  ...cardChromeStyle(rec),
                                }}
                                className="interactive"
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                                  <span
                                    style={{
                                      fontSize: '9px',
                                      fontWeight: '600',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: hexToRgba(groupingColor, 0.2),
                                      color: groupingColor,
                                      border: `1px solid ${hexToRgba(groupingColor, 0.35)}`,
                                    }}
                                  >
                                    {grouping}
                                  </span>
                                  {remaining !== undefined && (
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                      {remaining}m left
                                    </span>
                                  )}
                                </div>
                                <h5 style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                                  {rec.Name}
                                </h5>

                                {est > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--text-muted)' }}>
                                      <span style={{ color: isOver ? 'var(--accent-red)' : 'var(--text-muted)' }}>{logged}m logged</span>
                                      <span>{est}m est</span>
                                    </div>
                                    <div style={{ width: '100%', height: '3px', borderRadius: '1.5px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${Math.min((logged / est) * 100, 100)}%`, backgroundColor: isOver ? 'var(--accent-red)' : 'var(--accent-cyan)' }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {contextMenu && (
          <>
            <div
              onMouseDown={(e) => {
                if (e.button === 0) setContextMenu(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu(null);
              }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999,
                background: 'transparent',
              }}
            />
            <div
              style={{
                position: 'fixed',
                top: `${contextMenu.y}px`,
                left: `${contextMenu.x}px`,
                zIndex: 1000,
                width: '160px',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '4px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <button
                onClick={() => {
                  onEditTask(contextMenu.task);
                  setContextMenu(null);
                }}
                className="context-menu-item"
              >
                <Edit3 size={14} /> Edit Ticket
              </button>
              <button
                onClick={() => {
                  handleDuplicateTask(contextMenu.task);
                  setContextMenu(null);
                }}
                className="context-menu-item"
              >
                <Copy size={14} /> Duplicate
              </button>
              <div style={{ height: '1px', backgroundColor: 'var(--glass-border)', margin: '4px 0' }} />
              <button
                onClick={() => {
                  if (confirm('Delete this ticket permanently?')) {
                    handleDeleteTask(contextMenu.task.id);
                  }
                  setContextMenu(null);
                }}
                style={{ color: 'var(--accent-red)' }}
                className="context-menu-item"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // 2. Static Default Board Fallback Render
  const filteredTasks = tasks.filter(filterTask);

  const getTasksByStatus = (statusId) => {
    return filteredTasks.filter(t => t.status === statusId);
  };

  return (
    <div style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column', gap: '24px', overflow: 'hidden' }}>
      
      {/* Board Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700' }}>Kanban Board</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Drag & drop items to update focus status</p>
        </div>

        <button 
          onClick={() => onCreateTask({ category: categoryFilter })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: 'var(--accent-cyan)',
            border: 'none',
            borderRadius: '8px',
            color: 'var(--bg-primary)',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          <Plus size={16} /> Create Ticket
        </button>
      </div>

      {/* Unified Category & Owner Tabs */}
      {renderFilters()}

      {/* Board Columns Grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', overflow: 'hidden' }}>
        {STATUS_COLUMNS.map((col) => {
          const columnTasks = getTasksByStatus(col.id);
          return (
            <div 
              key={col.id} 
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className="glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(15, 23, 42, 0.25)',
                padding: '16px 12px',
                height: '100%',
                overflow: 'hidden'
              }}
            >
              {/* Column Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '0 4px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.color, boxShadow: `0 0 6px ${col.color}` }} />
                  <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{col.title}</h4>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '10px', fontWeight: '600' }}>
                  {columnTasks.length}
                </span>
              </div>

              {/* Task Cards Stack */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '2px' }}>
                {columnTasks.map((task) => {
                  const isOverEstimated = task.estimated_duration && task.current_duration > task.estimated_duration;
                  const grouping = getTaskGrouping(task);
                  const groupingColor = getGroupingColor(grouping, groupingColors);
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={(e) => {
                        if (e.button === 2) return;
                        onEditTask(task);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          task: task
                        });
                      }}
                      className="interactive"
                      style={{
                        padding: '14px',
                        border: '1px solid',
                        borderRadius: '10px',
                        cursor: 'grab',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        ...cardChromeStyle(task),
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: '600',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: hexToRgba(groupingColor, 0.2),
                            color: groupingColor,
                            border: `1px solid ${hexToRgba(groupingColor, 0.35)}`,
                          }}
                        >
                          {grouping}
                        </span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                          {task.source === 'notion_arch' ? 'Notion' : 'Plan'}
                        </span>
                      </div>

                      <h5 style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                        {task.name}
                      </h5>

                      {task.estimated_duration ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: isOverEstimated ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                              {isOverEstimated && <AlertCircle size={8} />}
                              {task.current_duration}m logged
                            </span>
                            <span>{task.estimated_duration}m est</span>
                          </div>
                          <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min((task.current_duration / task.estimated_duration) * 100, 100)}%`, backgroundColor: isOverEstimated ? 'var(--accent-red)' : 'var(--accent-cyan)' }} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>

      {contextMenu && (
        <>
          {/* Invisible overlay to close menu on click */}
          <div 
            onMouseDown={(e) => {
              if (e.button === 0) setContextMenu(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
              background: 'transparent'
            }}
          />
          {/* Context Menu Panel */}
          <div 
            style={{
              position: 'fixed',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              zIndex: 1000,
              width: '160px',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '4px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            <button 
              onClick={() => {
                onEditTask(contextMenu.task);
                setContextMenu(null);
              }}
              className="context-menu-item"
            >
              <Edit3 size={14} /> Edit Ticket
            </button>
            <button 
              onClick={() => {
                handleDuplicateTask(contextMenu.task);
                setContextMenu(null);
              }}
              className="context-menu-item"
            >
              <Copy size={14} /> Duplicate
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--glass-border)', margin: '4px 0' }} />
            <button 
              onClick={() => {
                if (confirm('Delete this ticket permanently?')) {
                  handleDeleteTask(contextMenu.task.id);
                }
                setContextMenu(null);
              }}
              style={{ color: 'var(--accent-red)' }}
              className="context-menu-item"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}

    </div>
  );
}
