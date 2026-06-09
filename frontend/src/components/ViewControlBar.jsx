import React, { useState, useEffect } from 'react';
import { Filter, ArrowUpDown, Layers, Plus, Trash2, X, Check } from 'lucide-react';

export default function ViewControlBar({ activeView, properties = [], onUpdateConfig, onDeleteView, onCreateTask }) {
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [showSortPopover, setShowSortPopover] = useState(false);
  const [showGroupPopover, setShowGroupPopover] = useState(false);

  // Filters State
  const [filters, setFilters] = useState(activeView.filters || { operator: 'and', rules: [] });
  // Sorts State
  const [sorts, setSorts] = useState(activeView.sorts || []);
  // Grouping State
  const [grouping, setGrouping] = useState(activeView.grouping || { group_by: '', subgroup_by: '' });

  // Sync state with active view
  useEffect(() => {
    setFilters(activeView.filters || { operator: 'and', rules: [] });
    setSorts(activeView.sorts || []);
    setGrouping(activeView.grouping || { group_by: '', subgroup_by: '' });
  }, [activeView]);

  const saveConfig = (updatedFilters, updatedSorts, updatedGrouping) => {
    onUpdateConfig({
      filters: updatedFilters || filters,
      sorts: updatedSorts || sorts,
      grouping: updatedGrouping || grouping
    });
  };

  // Filter Rules Management
  const addFilterRule = () => {
    const defaultProp = properties[0]?.name || 'Name';
    const newRule = { property: defaultProp, condition: 'equals', value: '' };
    const newFilters = {
      ...filters,
      rules: [...(filters.rules || []), newRule]
    };
    setFilters(newFilters);
    saveConfig(newFilters, null, null);
  };

  const updateFilterRule = (index, field, value) => {
    const newRules = [...filters.rules];
    newRules[index] = { ...newRules[index], [field]: value };
    const newFilters = { ...filters, rules: newRules };
    setFilters(newFilters);
    saveConfig(newFilters, null, null);
  };

  const removeFilterRule = (index) => {
    const newRules = filters.rules.filter((_, i) => i !== index);
    const newFilters = { ...filters, rules: newRules };
    setFilters(newFilters);
    saveConfig(newFilters, null, null);
  };

  const toggleFilterOperator = () => {
    const nextOp = filters.operator === 'and' ? 'or' : 'and';
    const newFilters = { ...filters, operator: nextOp };
    setFilters(newFilters);
    saveConfig(newFilters, null, null);
  };

  // Sort Rules Management
  const addSortRule = () => {
    const defaultProp = properties[0]?.name || 'Name';
    const newSorts = [...sorts, { property: defaultProp, direction: 'asc' }];
    setSorts(newSorts);
    saveConfig(null, newSorts, null);
  };

  const updateSortRule = (index, field, value) => {
    const newSorts = [...sorts];
    newSorts[index] = { ...newSorts[index], [field]: value };
    setSorts(newSorts);
    saveConfig(null, newSorts, null);
  };

  const removeSortRule = (index) => {
    const newSorts = sorts.filter((_, i) => i !== index);
    setSorts(newSorts);
    saveConfig(null, newSorts, null);
  };

  // Group Management
  const updateGrouping = (field, value) => {
    const newGrouping = { ...grouping, [field]: value };
    setGrouping(newGrouping);
    saveConfig(null, null, newGrouping);
  };

  // Clean / Filterable Fields (Exclude Dynamic calculated types for grouping)
  const groupableProperties = properties.filter(
    (p) => p.type === 'status' || p.type === 'select' || p.type === 'relation'
  );

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        background: 'rgba(15, 23, 42, 0.3)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--glass-border)',
        zIndex: 10,
        position: 'relative'
      }}
    >
      {/* View Details & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
          {activeView.name}
        </h2>
        {onCreateTask && (
          <button
            onClick={() => onCreateTask()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'var(--accent-cyan)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--bg-primary)',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            className="interactive"
          >
            <Plus size={14} /> New Ticket
          </button>
        )}
        {activeView.isDefault ? null : (
          <button
            onClick={onDeleteView}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-red)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: 0.8
            }}
            className="interactive"
          >
            <Trash2 size={14} /> Delete View
          </button>
        )}
      </div>

      {/* Query Settings Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        
        {/* Filter Trigger */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowFilterPopover(!showFilterPopover);
              setShowSortPopover(false);
              setShowGroupPopover(false);
            }}
            style={{
              background: (filters.rules || []).length > 0 ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: (filters.rules || []).length > 0 ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
            className="interactive"
          >
            <Filter size={14} />
            Filter {(filters.rules || []).length > 0 ? `(${filters.rules.length})` : ''}
          </button>

          {showFilterPopover && (
            <div 
              style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                width: '380px',
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(30px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                zIndex: 20
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Filters</span>
                {(filters.rules || []).length > 1 && (
                  <button 
                    onClick={toggleFilterOperator}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      color: 'var(--accent-cyan)',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Match: {filters.operator.toUpperCase()}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' }}>
                {(filters.rules || []).map((rule, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      value={rule.property}
                      onChange={(e) => updateFilterRule(idx, 'property', e.target.value)}
                      style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '4px', padding: '4px', fontSize: '11px', flex: 1 }}
                    >
                      {properties.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>

                    <select
                      value={rule.condition}
                      onChange={(e) => updateFilterRule(idx, 'condition', e.target.value)}
                      style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '4px', padding: '4px', fontSize: '11px' }}
                    >
                      <option value="equals">equals</option>
                      <option value="contains">contains</option>
                      <option value="is_empty">is empty</option>
                      <option value="is_not_empty">is not empty</option>
                      <option value="greater_than">&gt;</option>
                      <option value="less_than">&lt;</option>
                    </select>

                    {rule.condition !== 'is_empty' && rule.condition !== 'is_not_empty' && (
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => updateFilterRule(idx, 'value', e.target.value)}
                        style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', width: '90px' }}
                        placeholder="Value..."
                      />
                    )}

                    <button 
                      onClick={() => removeFilterRule(idx)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addFilterRule}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} /> Add filter rule
              </button>
            </div>
          )}
        </div>

        {/* Sort Trigger */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowSortPopover(!showSortPopover);
              setShowFilterPopover(false);
              setShowGroupPopover(false);
            }}
            style={{
              background: sorts.length > 0 ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: sorts.length > 0 ? 'var(--accent-purple)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
            className="interactive"
          >
            <ArrowUpDown size={14} />
            Sort {sorts.length > 0 ? `(${sorts.length})` : ''}
          </button>

          {showSortPopover && (
            <div 
              style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                width: '300px',
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(30px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                zIndex: 20
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>Sorting Priority</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', marginBottom: '12px' }}>
                {sorts.map((sort, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      value={sort.property}
                      onChange={(e) => updateSortRule(idx, 'property', e.target.value)}
                      style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '4px', padding: '4px', fontSize: '11px', flex: 1 }}
                    >
                      {properties.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>

                    <select
                      value={sort.direction}
                      onChange={(e) => updateSortRule(idx, 'direction', e.target.value)}
                      style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '4px', padding: '4px', fontSize: '11px' }}
                    >
                      <option value="asc">ascending</option>
                      <option value="desc">descending</option>
                    </select>

                    <button 
                      onClick={() => removeSortRule(idx)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addSortRule}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-purple)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} /> Add sort rule
              </button>
            </div>
          )}
        </div>

        {/* Grouping / Swimlane Trigger */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowGroupPopover(!showGroupPopover);
              setShowFilterPopover(false);
              setShowSortPopover(false);
            }}
            style={{
              background: (grouping.group_by || grouping.subgroup_by) ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: (grouping.group_by || grouping.subgroup_by) ? 'var(--accent-orange)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
            className="interactive"
          >
            <Layers size={14} />
            Group
          </button>

          {showGroupPopover && (
            <div 
              style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                width: '260px',
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(30px)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                zIndex: 20
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>Grouping Rules</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Group By (Columns)</label>
                  <select
                    value={grouping.group_by || ''}
                    onChange={(e) => updateGrouping('group_by', e.target.value)}
                    style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '6px', padding: '6px', fontSize: '12px', width: '100%' }}
                  >
                    <option value="">None (Flat)</option>
                    {groupableProperties.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Subgroup By (Swimlanes)</label>
                  <select
                    value={grouping.subgroup_by || ''}
                    onChange={(e) => updateGrouping('subgroup_by', e.target.value)}
                    style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '6px', padding: '6px', fontSize: '12px', width: '100%' }}
                  >
                    <option value="">None</option>
                    {groupableProperties.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
