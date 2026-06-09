import React, { useState } from 'react';
import { Search, Plus, ArrowUpDown } from 'lucide-react';
import api from '../api';
import ViewControlBar from '../components/ViewControlBar';

export default function Backlog({ 
  tasks, 
  projects, 
  onRefresh, 
  onEditTask,
  onCreateTask,
  activeView,
  properties,
  viewResult,
  onUpdateConfig,
  onDeleteView
}) {
  const [searchText, setSearchText] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [quickTitle, setQuickTitle] = useState('');
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);

  // Sorting for fallback flat table
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleQuickCreate = async (e) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    setIsCreatingQuick(true);
    try {
      const newTask = await api.tasks.create({
        name: quickTitle,
        status: 'backlog',
        category: 'business',
        source: 'planning'
      });

      setQuickTitle('');
      onRefresh();
      
      const classification = await api.ai.classify({
        name: newTask.name,
        description: ''
      });

      await api.tasks.update(newTask.id, {
        ...newTask,
        category: classification.category,
        project_id: classification.project_id || null,
        estimated_duration: classification.estimated_duration || 60
      });

      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingQuick(false);
    }
  };

  // Render Dynamic Relational Mode
  if (viewResult) {
    // Get visible columns defined by view metadata
    const visibleCols = viewResult.visible_properties || ["Name", "Status", "Category"];
    
    // Flatten grouped structure into a simple array if grouped, or read flat list
    let recordsList = [];
    if (viewResult.grouped) {
      const groups = viewResult.groups || {};
      
      const traverseGroups = (obj) => {
        Object.keys(obj).forEach(key => {
          const val = obj[key];
          if (Array.isArray(val)) {
            recordsList = [...recordsList, ...val];
          } else if (typeof val === 'object' && val !== null) {
            traverseGroups(val);
          }
        });
      };
      
      traverseGroups(groups);
    } else {
      recordsList = viewResult.records || [];
    }

    recordsList = recordsList.filter(rec => {
      if (ownerFilter === 'all') return true;
      const ownerVal = rec.Owner || rec.owner || '';
      if (ownerFilter === 'Alice') return ownerVal === 'Alice' || ownerVal === 'Shared';
      if (ownerFilter === 'Bob') return ownerVal === 'Bob' || ownerVal === 'Shared';
      return true;
    });

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

        {/* Owner Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', padding: '16px 24px 0 24px', flexShrink: 0 }}>
          {[
            { id: 'all', label: 'All Tasks' },
            { id: 'Alice', label: 'Alice Tasks' },
            { id: 'Bob', label: 'Bob Tasks' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setOwnerFilter(tab.id)}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                border: '1px solid var(--glass-border)',
                background: ownerFilter === tab.id ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.03)',
                color: ownerFilter === tab.id ? 'var(--bg-primary)' : 'var(--text-primary)',
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

        {/* Quick Creator Bar */}
        <div style={{ padding: '24px 24px 0 24px', flexShrink: 0 }}>
          <form onSubmit={handleQuickCreate} style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Quick create ticket (e.g., Verify organizations list filters)..."
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              disabled={isCreatingQuick}
              style={{
                flex: 1,
                padding: '10px 14px',
                backgroundColor: 'rgba(15, 23, 42, 0.25)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '13px'
              }}
            />
            <button 
              type="submit"
              disabled={isCreatingQuick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                backgroundColor: 'var(--accent-cyan)',
                border: 'none',
                borderRadius: '8px',
                color: 'var(--bg-primary)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              <Plus size={16} /> Add Task
            </button>
          </form>
        </div>

        {/* Table Container */}
        <div style={{ flex: 1, padding: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', background: 'rgba(15, 23, 42, 0.2)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.4)' }}>
                  {visibleCols.map((colName) => (
                    <th key={colName} style={{ padding: '16px 20px', fontWeight: '600' }}>
                      {colName.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recordsList.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCols.length} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                      No matching records found in table.
                    </td>
                  </tr>
                ) : (
                  recordsList.map((rec) => {
                    return (
                      <tr 
                        key={rec.id} 
                        style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background-color 0.2s ease' }}
                        className="interactive"
                      >
                        {visibleCols.map((colName) => {
                          const val = rec[colName];
                          
                          // Custom Column Render logic
                          if (colName === 'Name') {
                            return (
                              <td key={colName} style={{ padding: '14px 20px', fontWeight: '500' }}>
                                <span 
                                  onClick={() => onEditTask({
                                    id: rec.id,
                                    name: rec.Name,
                                    description: rec.Description,
                                    status: rec.Status,
                                    category: rec.Category,
                                    estimated_duration: rec['Estimated Duration'],
                                    current_duration: rec['Current Duration'],
                                    source: rec.Source
                                  })}
                                  style={{ cursor: 'pointer', color: 'var(--text-primary)' }}
                                >
                                  {val}
                                </span>
                              </td>
                            );
                          }

                          if (colName === 'Status') {
                            return (
                              <td key={colName} style={{ padding: '14px 20px', textTransform: 'capitalize' }}>
                                <span 
                                  style={{ 
                                    fontSize: '11px', 
                                    padding: '2px 8px', 
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    color: val === 'done' ? 'var(--accent-green)' : 
                                           val === 'in_progress' ? 'var(--accent-purple)' : 
                                           val === 'on_hold' ? 'var(--accent-yellow)' : 'var(--text-secondary)'
                                  }}
                                >
                                  {String(val || '').replace('_', ' ')}
                                </span>
                              </td>
                            );
                          }

                          if (colName === 'Project') {
                            const relatedProjName = val && val[0] ? val[0] : '';
                            return (
                              <td key={colName} style={{ padding: '14px 20px' }}>
                                <span style={{ color: 'var(--accent-cyan)', fontWeight: '600', fontSize: '11px' }}>
                                  {relatedProjName || 'Unassigned'}
                                </span>
                              </td>
                            );
                          }

                          // Default rendering
                          return (
                            <td key={colName} style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                              {val !== undefined ? String(val) : '--'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Flat Backlog view fallback (Static mode)
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchText.toLowerCase()) || 
                          (t.description || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesProject = projectFilter === '' || t.project_id === projectFilter;
    
    let matchesOwner = true;
    if (ownerFilter !== 'all') {
      const ownerVal = t.owner || '';
      if (ownerFilter === 'Alice') matchesOwner = (ownerVal === 'Alice' || ownerVal === 'Shared');
      else if (ownerFilter === 'Bob') matchesOwner = (ownerVal === 'Bob' || ownerVal === 'Shared');
    }
    
    return matchesSearch && matchesProject && matchesOwner;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column', gap: '24px', overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ flexShrink: 0 }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700' }}>Task Backlog</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>View, search, and manage task backlog</p>
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexShrink: 0 }}>
        
        {/* Search & Project Filter */}
        <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '600px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search 
              size={16} 
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
            />
            <input 
              type="text" 
              placeholder="Search backlog..." 
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 10px 10px 38px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '13px'
              }}
            />
          </div>

          <select 
            value={projectFilter} 
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{
              padding: '10px 16px',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              outline: 'none',
              fontSize: '13px'
            }}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Owner Filter Tabs (Static View) */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'all', label: 'All Tasks' },
            { id: 'Alice', label: 'Alice Tasks' },
            { id: 'Bob', label: 'Bob Tasks' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setOwnerFilter(tab.id)}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                border: '1px solid var(--glass-border)',
                background: ownerFilter === tab.id ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.03)',
                color: ownerFilter === tab.id ? 'var(--bg-primary)' : 'var(--text-primary)',
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

      {/* Quick Creator Bar */}
      <form onSubmit={handleQuickCreate} style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
        <input 
          type="text" 
          placeholder="Quick create ticket (e.g., Verify organizations list filters)..."
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          disabled={isCreatingQuick}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.25)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            outline: 'none',
            fontSize: '13px'
          }}
        />
        <button 
          type="submit"
          disabled={isCreatingQuick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '12px 20px',
            backgroundColor: 'var(--accent-cyan)',
            border: 'none',
            borderRadius: '8px',
            color: 'var(--bg-primary)',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          <Plus size={16} /> Add Task
        </button>
      </form>

      {/* Table Backlog Container */}
      <div 
        className="glass-panel" 
        style={{ 
          flex: 1, 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column',
          background: 'rgba(15, 23, 42, 0.2)' 
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.4)' }}>
                <th 
                  onClick={() => handleSort('name')} 
                  style={{ padding: '16px 20px', cursor: 'pointer', fontWeight: '600' }}
                >
                  TICKET NAME <ArrowUpDown size={12} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                </th>
                <th 
                  onClick={() => handleSort('status')} 
                  style={{ padding: '16px', cursor: 'pointer', fontWeight: '600' }}
                >
                  STATUS <ArrowUpDown size={12} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                </th>
                <th 
                  onClick={() => handleSort('category')} 
                  style={{ padding: '16px', cursor: 'pointer', fontWeight: '600' }}
                >
                  CATEGORY <ArrowUpDown size={12} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                </th>
                <th style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '600' }}>DURATION</th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    No matching tickets found in backlog.
                  </td>
                </tr>
              ) : (
                sortedTasks.map((t) => {
                  return (
                    <tr 
                      key={t.id} 
                      style={{ borderBottom: '1px solid var(--glass-border)' }}
                    >
                      <td style={{ padding: '14px 20px', fontWeight: '500' }}>
                        <span 
                          onClick={() => onEditTask(t)}
                          style={{ cursor: 'pointer', color: 'var(--text-primary)', transition: 'color 0.2s ease' }}
                          onMouseOver={(e) => e.target.style.color = 'var(--accent-cyan)'}
                          onMouseOut={(e) => e.target.style.color = 'var(--text-primary)'}
                        >
                          {t.name}
                        </span>
                      </td>
                      <td style={{ padding: '14px', textTransform: 'capitalize' }}>
                        <span 
                          style={{ 
                            fontSize: '11px', 
                            padding: '2px 8px', 
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: t.status === 'done' ? 'var(--accent-green)' : 
                                   t.status === 'in_progress' ? 'var(--accent-purple)' : 
                                   t.status === 'on_hold' ? 'var(--accent-yellow)' : 'var(--text-secondary)'
                          }}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '14px', textTransform: 'uppercase', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                        {t.category === 'dev' ? 'Technical' : t.category}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {t.current_duration}m / {t.estimated_duration ? `${t.estimated_duration}m` : '--'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
