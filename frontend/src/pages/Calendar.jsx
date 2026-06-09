import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import api from '../api';
import Toast from '../components/Toast';
import { getDailyBlockAccentColor } from '../utils/groupingColors';

export const SLOT_MINUTES = 15;
const GRID_START_HOUR = 7;
const GRID_END_HOUR = 22;
const GRID_START_MINUTES = GRID_START_HOUR * 60;
const GRID_END_MINUTES = GRID_END_HOUR * 60;
const DAY_SPAN_MINUTES = GRID_END_MINUTES - GRID_START_MINUTES;
const SLOT_HEIGHT = 20;
const GRID_HEIGHT = (DAY_SPAN_MINUTES / SLOT_MINUTES) * SLOT_HEIGHT;
const RESIZE_HANDLE_HEIGHT = 6;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** ISO Monday for the week containing `date`. */
export function computeWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Local YYYY-MM-DD (no UTC shift). */
export function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function snapToSlot(minutes, slotMinutes = SLOT_MINUTES) {
  return Math.round(minutes / slotMinutes) * slotMinutes;
}

export function parseTimeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutesToTime(minutes) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTimeRange(start, end) {
  return `${start} – ${end}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function minutesFromGridY(y) {
  const ratio = y / GRID_HEIGHT;
  const raw = GRID_START_MINUTES + ratio * DAY_SPAN_MINUTES;
  return snapToSlot(raw);
}

function blockStyle(startTime, endTime) {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  const visibleStart = Math.max(startMin, GRID_START_MINUTES);
  const visibleEnd = Math.min(endMin, GRID_END_MINUTES);
  if (visibleEnd <= visibleStart) return { display: 'none' };
  const top = ((visibleStart - GRID_START_MINUTES) / DAY_SPAN_MINUTES) * GRID_HEIGHT;
  const height = ((visibleEnd - visibleStart) / DAY_SPAN_MINUTES) * GRID_HEIGHT;
  return { top, height: Math.max(height, SLOT_HEIGHT / 2) };
}

/** Assign columnIndex / columnCount for overlapping blocks on one day. */
export function assignOverlapColumns(blocks) {
  if (!blocks.length) return [];

  const sorted = [...blocks].sort(
    (a, b) => parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time)
  );

  const groups = [];
  let currentGroup = [];
  let groupEnd = 0;

  for (const block of sorted) {
    const start = parseTimeToMinutes(block.start_time);
    const end = parseTimeToMinutes(block.end_time);
    if (currentGroup.length === 0 || start < groupEnd) {
      currentGroup.push(block);
      groupEnd = Math.max(groupEnd, end);
    } else {
      groups.push(currentGroup);
      currentGroup = [block];
      groupEnd = end;
    }
  }
  if (currentGroup.length) groups.push(currentGroup);

  const layoutMap = new Map();

  for (const group of groups) {
    const columnEnds = [];
    for (const block of group) {
      const start = parseTimeToMinutes(block.start_time);
      const end = parseTimeToMinutes(block.end_time);
      let col = columnEnds.findIndex((endMin) => endMin <= start);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(end);
      } else {
        columnEnds[col] = end;
      }
      layoutMap.set(block.id, { columnIndex: col, columnCount: columnEnds.length });
    }
    const count = columnEnds.length;
    for (const block of group) {
      const entry = layoutMap.get(block.id);
      entry.columnCount = count;
    }
  }

  return blocks.map((block) => {
    const layout = layoutMap.get(block.id) || { columnIndex: 0, columnCount: 1 };
    return { ...block, ...layout };
  });
}

function getBlockTitle(block) {
  const base = block.title ?? block.parent_task_name ?? 'Untitled block';
  if (block.parent_archived) return `${base} (archived)`;
  return base;
}

function ownerBadge(owner) {
  if (owner === 'Bob') return '🅱️';
  if (owner === 'Shared') return '🤝';
  return 'Ⓐ';
}

function blockMatchesOwnerFilter(block, ownerFilter) {
  const owner = block.owner || 'Alice';
  if (ownerFilter === 'Alice') return owner === 'Alice' || owner === 'Shared';
  if (ownerFilter === 'Bob') return owner === 'Bob' || owner === 'Shared';
  return true;
}

function BlockModal({
  mode,
  initial,
  tasks,
  defaultOwner = 'Alice',
  onConfirm,
  onCancel,
}) {
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.start_time);
  const [endTime, setEndTime] = useState(initial.end_time);
  const [title, setTitle] = useState(initial.title || '');
  const [taskId, setTaskId] = useState(initial.task_id || '');
  const [owner, setOwner] = useState(initial.owner || defaultOwner);
  const [search, setSearch] = useState('');

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks.slice(0, 50);
    return tasks.filter((t) => t.name?.toLowerCase().includes(q)).slice(0, 50);
  }, [tasks, search]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      date,
      start_time: startTime,
      end_time: endTime,
      title: title.trim() || null,
      task_id: taskId || null,
      owner,
    });
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    backgroundColor: 'var(--input-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    outline: 'none',
    fontSize: '13px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--modal-overlay)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 150,
      }}
      onClick={onCancel}
    >
      <div
        className="glass-panel"
        style={{ width: '400px', padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' }}>
          {mode === 'create' ? 'Create block' : 'Edit block'}
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Start</label>
              <input type="time" value={startTime} step="900" onChange={(e) => setStartTime(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>End</label>
              <input type="time" value={endTime} step="900" onChange={(e) => setEndTime(e.target.value)} required style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Title (optional)</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Block title" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Owner</label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} style={inputStyle}>
              <option value="Alice">Ⓐ Alice</option>
              <option value="Bob">🅱️ Bob</option>
              <option value="Shared">🤝 Shared</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Link to task (optional)</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              style={{ ...inputStyle, marginBottom: '6px' }}
            />
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)} style={inputStyle}>
              <option value="">— None —</option>
              {filteredTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={onCancel} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--nav-active-bg)', color: 'var(--text-primary)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent-cyan)', color: 'var(--bg-primary)', fontWeight: '600', cursor: 'pointer' }}>
              {mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Calendar({
  projects = [],
  groupingColors = {},
  calendarAnchorDate = null,
  dailyTasksVersion = 0,
  onDailyTasksChange,
  onEditTask,
  onViewChange,
}) {
  const scrollRef = useRef(null);
  const gridRef = useRef(null);

  const [weekStartDate, setWeekStartDate] = useState(() =>
    computeWeekStart(calendarAnchorDate ? new Date(calendarAnchorDate) : new Date())
  );
  const [dailyTasks, setDailyTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [createPreview, setCreatePreview] = useState(null);
  const [modalState, setModalState] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState('Alice');

  const dragStateRef = useRef(null);
  const createPreviewRef = useRef(null);
  const dailyTasksRef = useRef(dailyTasks);
  const wasDraggingRef = useRef(false);

  useEffect(() => { dragStateRef.current = dragState; }, [dragState]);
  useEffect(() => { createPreviewRef.current = createPreview; }, [createPreview]);
  useEffect(() => { dailyTasksRef.current = dailyTasks; }, [dailyTasks]);

  const weekDates = useMemo(() => getWeekDates(weekStartDate), [weekStartDate]);
  const todayStr = formatLocalDate(new Date());

  useEffect(() => {
    if (calendarAnchorDate) {
      setWeekStartDate(computeWeekStart(new Date(calendarAnchorDate)));
    }
  }, [calendarAnchorDate]);

  const fetchWeek = useCallback(async () => {
    const start = formatLocalDate(weekStartDate);
    const end = formatLocalDate(addDays(weekStartDate, 6));
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.dailyTasks.list({ start_date: start, end_date: end });
      setDailyTasks(data);
    } catch (e) {
      console.error('Failed to load daily tasks', e);
      setError('Failed to load calendar blocks.');
    } finally {
      setIsLoading(false);
    }
  }, [weekStartDate]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek, dailyTasksVersion]);

  useEffect(() => {
    const now = new Date();
    const todayInWeek = weekDates.some((d) => formatLocalDate(d) === formatLocalDate(now));
    if (todayInWeek && scrollRef.current) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const scrollTarget = ((nowMinutes - GRID_START_MINUTES) / DAY_SPAN_MINUTES) * GRID_HEIGHT - 120;
      scrollRef.current.scrollTop = Math.max(0, scrollTarget);
    }
  }, [weekDates, isLoading]);

  const showToast = (msg) => setToastMessage(msg);

  const handleDeleteBlock = useCallback(async (blockId) => {
    const block = dailyTasks.find((b) => b.id === blockId);
    if (!block) return;
    if (!window.confirm('Delete this calendar block?')) return;
    try {
      await api.dailyTasks.delete(blockId);
      setSelectedBlockId(null);
      onDailyTasksChange?.();
    } catch (e) {
      console.error('Failed to delete block', e);
      showToast('Failed to delete block.');
    }
  }, [dailyTasks, onDailyTasksChange]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedBlockId && !modalState) {
        e.preventDefault();
        handleDeleteBlock(selectedBlockId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, modalState, handleDeleteBlock]);

  const filteredDailyTasks = useMemo(
    () => dailyTasks.filter((task) => blockMatchesOwnerFilter(task, ownerFilter)),
    [dailyTasks, ownerFilter]
  );

  const blocksByDate = useMemo(() => {
    const map = {};
    for (const d of weekDates) {
      map[formatLocalDate(d)] = [];
    }
    for (const task of filteredDailyTasks) {
      if (map[task.date]) {
        map[task.date].push(task);
      }
    }
    for (const date of Object.keys(map)) {
      map[date] = assignOverlapColumns(map[date]);
    }
    return map;
  }, [filteredDailyTasks, weekDates]);

  const updateBlockLocal = (blockId, patch) => {
    setDailyTasks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b))
    );
  };

  const persistBlockUpdate = async (blockId, snapshot, patch) => {
    try {
      await api.dailyTasks.update(blockId, patch);
      onDailyTasksChange?.();
    } catch (e) {
      console.error('Failed to save block', e);
      updateBlockLocal(blockId, snapshot);
      showToast('Failed to save — reverted.');
    }
  };

  const handleBlockClick = async (block, e) => {
    if (dragState || wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    e.stopPropagation();
    setSelectedBlockId(block.id);

    if (block.task_id) {
      try {
        const task = await api.tasks.get(block.task_id);
        onEditTask?.(task);
      } catch (err) {
        console.error('Failed to load linked task', err);
        showToast('Failed to open linked task.');
      }
    } else {
      setModalState({ mode: 'edit', block });
    }
  };

  const openCreateModal = async (defaults) => {
    try {
      const tasks = await api.tasks.list();
      setAllTasks(tasks);
    } catch (e) {
      console.error('Failed to load tasks for link dropdown', e);
      setAllTasks([]);
    }
    setModalState({ mode: 'create', defaults });
  };

  const handleModalConfirm = async (payload) => {
    if (modalState.mode === 'create') {
      try {
        await api.dailyTasks.create(payload);
        setModalState(null);
        setCreatePreview(null);
        onDailyTasksChange?.();
      } catch (e) {
        console.error('Failed to create block', e);
        showToast('Failed to create block.');
      }
    } else {
      const block = modalState.block;
      try {
        await api.dailyTasks.update(block.id, payload);
        setModalState(null);
        onDailyTasksChange?.();
      } catch (e) {
        console.error('Failed to update block', e);
        showToast('Failed to save block.');
      }
    }
  };

  const navigateWeek = (delta) => {
    setWeekStartDate((prev) => addDays(prev, delta * 7));
    setSelectedBlockId(null);
  };

  const getDayIndexFromEvent = (clientX) => {
    const grid = gridRef.current;
    if (!grid) return 0;
    const dayCols = grid.querySelectorAll('[data-day-column]');
    for (let i = 0; i < dayCols.length; i++) {
      const rect = dayCols[i].getBoundingClientRect();
      if (clientX >= rect.left && clientX < rect.right) return i;
    }
    return 0;
  };

  const getYInGrid = (clientY) => {
    const grid = gridRef.current;
    if (!grid) return 0;
    const rect = grid.getBoundingClientRect();
    return Math.max(0, Math.min(GRID_HEIGHT, clientY - rect.top));
  };

  const clampSchedule = (date, startMin, endMin) => {
    let start = snapToSlot(startMin);
    let end = snapToSlot(endMin);
    start = Math.max(GRID_START_MINUTES, Math.min(start, GRID_END_MINUTES - SLOT_MINUTES));
    end = Math.max(start + SLOT_MINUTES, Math.min(end, 23 * 60 + 59));
    end = snapToSlot(end);
    if (end <= start) end = start + SLOT_MINUTES;
    return {
      date,
      start_time: formatMinutesToTime(start),
      end_time: formatMinutesToTime(end),
    };
  };

  const handlePointerDownEmpty = (e, dayIndex) => {
    if (e.button !== 0) return;
    wasDraggingRef.current = false;
    const date = formatLocalDate(weekDates[dayIndex]);
    const y = getYInGrid(e.clientY);
    const startMin = minutesFromGridY(y);
    setDragState({
      type: 'create',
      dayIndex,
      startY: y,
      currentY: y,
      date,
    });
    setCreatePreview(clampSchedule(date, startMin, startMin + SLOT_MINUTES));
  };

  const handlePointerDownBlock = (e, block, interaction) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    wasDraggingRef.current = false;
    const snapshot = { date: block.date, start_time: block.start_time, end_time: block.end_time };
    setDragState({
      type: interaction,
      blockId: block.id,
      snapshot,
      startY: getYInGrid(e.clientY),
      startX: e.clientX,
      originDayIndex: weekDates.findIndex((d) => formatLocalDate(d) === block.date),
    });
    setSelectedBlockId(block.id);
  };

  useEffect(() => {
    if (!dragState) return undefined;

    const onMove = (e) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      wasDraggingRef.current = true;

      if (ds.type === 'create') {
        const y = getYInGrid(e.clientY);
        const startMin = minutesFromGridY(Math.min(ds.startY, y));
        const endMin = minutesFromGridY(Math.max(ds.startY, y));
        const dayIndex = getDayIndexFromEvent(e.clientX);
        const date = formatLocalDate(weekDates[dayIndex]);
        setCreatePreview(clampSchedule(date, startMin, Math.max(endMin, startMin + SLOT_MINUTES)));
        return;
      }

      const block = dailyTasksRef.current.find((b) => b.id === ds.blockId);
      if (!block) return;

      const y = getYInGrid(e.clientY);
      const deltaY = y - ds.startY;
      const deltaMinutes = snapToSlot((deltaY / GRID_HEIGHT) * DAY_SPAN_MINUTES);

      const snap = ds.snapshot;
      const snapStart = parseTimeToMinutes(snap.start_time);
      const snapEnd = parseTimeToMinutes(snap.end_time);
      const duration = snapEnd - snapStart;

      if (ds.type === 'resize-top') {
        const newStart = snapStart + deltaMinutes;
        const clamped = clampSchedule(snap.date, newStart, snapEnd);
        if (parseTimeToMinutes(clamped.end_time) - parseTimeToMinutes(clamped.start_time) >= SLOT_MINUTES) {
          updateBlockLocal(block.id, { start_time: clamped.start_time, end_time: clamped.end_time });
        }
      } else if (ds.type === 'resize-bottom') {
        const newEnd = snapEnd + deltaMinutes;
        const clamped = clampSchedule(snap.date, snapStart, newEnd);
        if (parseTimeToMinutes(clamped.end_time) - parseTimeToMinutes(clamped.start_time) >= SLOT_MINUTES) {
          updateBlockLocal(block.id, { start_time: clamped.start_time, end_time: clamped.end_time });
        }
      } else if (ds.type === 'move') {
        const dayIndex = getDayIndexFromEvent(e.clientX);
        const date = formatLocalDate(weekDates[dayIndex]);
        const newStart = snapStart + deltaMinutes;
        const clamped = clampSchedule(date, newStart, newStart + duration);
        updateBlockLocal(block.id, {
          date: clamped.date,
          start_time: clamped.start_time,
          end_time: clamped.end_time,
        });
      }
    };

    const onUp = async () => {
      const ds = dragStateRef.current;
      if (!ds) return;

      if (ds.type === 'create') {
        const preview = createPreviewRef.current;
        setDragState(null);
        if (preview) await openCreateModal(preview);
        return;
      }

      const block = dailyTasksRef.current.find((b) => b.id === ds.blockId);
      setDragState(null);

      if (!block) return;

      const snap = ds.snapshot;
      const patch = {};
      if (block.date !== snap.date) patch.date = block.date;
      if (block.start_time !== snap.start_time) patch.start_time = block.start_time;
      if (block.end_time !== snap.end_time) patch.end_time = block.end_time;

      if (Object.keys(patch).length === 0) return;

      await persistBlockUpdate(block.id, snap, patch);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [dragState, weekDates]);

  const handleContextMenuBlock = (e, blockId) => {
    e.preventDefault();
    setSelectedBlockId(blockId);
    handleDeleteBlock(blockId);
  };

  const weekLabel = `${formatLocalDate(weekDates[0])} — ${formatLocalDate(weekDates[6])}`;

  const hourLabels = [];
  for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) {
    hourLabels.push(`${String(h).padStart(2, '0')}:00`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 28px',
          borderBottom: '1px solid var(--glass-border)',
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Weekly Calendar
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{weekLabel}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => navigateWeek(-1)}
            className="interactive"
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', cursor: 'pointer' }}
            aria-label="Previous week"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setWeekStartDate(computeWeekStart(new Date()))}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => navigateWeek(1)}
            className="interactive"
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', cursor: 'pointer' }}
            aria-label="Next week"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => openCreateModal({
              date: todayStr,
              start_time: '09:00',
              end_time: '10:00',
              title: '',
              task_id: null,
              owner: ownerFilter,
            })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent-cyan)',
              color: 'var(--bg-primary)',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '13px',
              marginLeft: '8px',
            }}
          >
            <Plus size={16} />
            Create block
          </button>
        </div>
      </div>

      {/* Owner filter — separate calendar per person; Shared blocks appear on both */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 28px',
          borderBottom: '1px solid var(--glass-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: '700' }}>
          Calendar:
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'Alice', label: 'Ⓐ Alice' },
            { id: 'Bob', label: '🅱️ Bob' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOwnerFilter(tab.id)}
              className="interactive"
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                border: '1px solid var(--glass-border)',
                background: ownerFilter === tab.id ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.03)',
                color: ownerFilter === tab.id ? '#fff' : 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          🤝 Shared blocks show on both calendars
        </span>
      </div>

      {error && (
        <div style={{ padding: '12px 28px', color: 'var(--accent-red)', fontSize: '13px' }}>{error}</div>
      )}

      {/* Grid scroll area */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '0 28px 28px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <div className="spinner" />
          </div>
        ) : (
          <div style={{ position: 'relative', minWidth: '900px' }}>
            {/* Day headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '56px repeat(7, 1fr)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'var(--bg-primary)',
                paddingTop: '12px',
                paddingBottom: '8px',
              }}
            >
              <div />
              {weekDates.map((d, i) => {
                const dateStr = formatLocalDate(d);
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={dateStr}
                    style={{
                      textAlign: 'center',
                      fontSize: '13px',
                      fontWeight: isToday ? '700' : '500',
                      color: isToday ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      padding: '6px 0',
                      borderBottom: isToday ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                    }}
                  >
                    {DAY_LABELS[i]} {d.getDate()}
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div
              ref={gridRef}
              style={{
                display: 'grid',
                gridTemplateColumns: '56px repeat(7, 1fr)',
                position: 'relative',
              }}
            >
              {/* Time labels column */}
              <div style={{ position: 'relative', height: GRID_HEIGHT }}>
                {hourLabels.map((label, i) => (
                  <div
                    key={label}
                    style={{
                      position: 'absolute',
                      top: (i / (hourLabels.length - 1)) * GRID_HEIGHT - 8,
                      right: '8px',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDates.map((d, dayIndex) => {
                const dateStr = formatLocalDate(d);
                const isToday = dateStr === todayStr;
                const dayBlocks = blocksByDate[dateStr] || [];

                return (
                  <div
                    key={dateStr}
                    data-day-column
                    style={{
                      position: 'relative',
                      height: GRID_HEIGHT,
                      borderLeft: '1px solid var(--glass-border)',
                      background: isToday ? 'var(--nav-active-bg)' : 'transparent',
                    }}
                    onPointerDown={(e) => {
                      if (e.target === e.currentTarget || e.target.dataset.slot) {
                        handlePointerDownEmpty(e, dayIndex);
                      }
                    }}
                  >
                    {/* Slot grid lines */}
                    {Array.from({ length: DAY_SPAN_MINUTES / SLOT_MINUTES }, (_, slot) => (
                      <div
                        key={slot}
                        data-slot
                        style={{
                          position: 'absolute',
                          top: slot * SLOT_HEIGHT,
                          left: 0,
                          right: 0,
                          height: SLOT_HEIGHT,
                          borderTop: slot % 4 === 0
                            ? '1px solid var(--glass-border)'
                            : '1px solid var(--nav-active-bg)',
                          pointerEvents: 'none',
                        }}
                      />
                    ))}

                    {/* Create preview */}
                    {createPreview && createPreview.date === dateStr && (() => {
                      const pos = blockStyle(createPreview.start_time, createPreview.end_time);
                      return (
                        <div
                          style={{
                            position: 'absolute',
                            left: '4px',
                            right: '4px',
                            ...pos,
                            background: 'var(--accent-cyan)',
                            opacity: 0.35,
                            borderRadius: '6px',
                            pointerEvents: 'none',
                            zIndex: 5,
                          }}
                        />
                      );
                    })()}

                    {/* Blocks */}
                    {dayBlocks.map((block) => {
                      const pos = blockStyle(block.start_time, block.end_time);
                      if (pos.display === 'none') return null;
                      const accent = getDailyBlockAccentColor(block, projects, groupingColors);
                      const widthPct = 100 / block.columnCount;
                      const leftPct = block.columnIndex * widthPct;
                      const showSubtitle = pos.height >= 45;
                      const isSelected = selectedBlockId === block.id;
                      const isArchived = block.parent_archived === true;

                      return (
                        <div
                          key={block.id}
                          style={{
                            position: 'absolute',
                            top: pos.top,
                            height: pos.height,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            background: 'var(--glass-bg)',
                            border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            cursor: 'grab',
                            opacity: isArchived ? 0.7 : 1,
                            zIndex: isSelected ? 8 : 6,
                            display: 'flex',
                            boxShadow: 'var(--shadow-glow)',
                          }}
                          onClick={(e) => handleBlockClick(block, e)}
                          onContextMenu={(e) => handleContextMenuBlock(e, block.id)}
                          onPointerDown={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relY = e.clientY - rect.top;
                            if (relY <= RESIZE_HANDLE_HEIGHT) {
                              handlePointerDownBlock(e, block, 'resize-top');
                            } else if (relY >= rect.height - RESIZE_HANDLE_HEIGHT) {
                              handlePointerDownBlock(e, block, 'resize-bottom');
                            } else {
                              handlePointerDownBlock(e, block, 'move');
                            }
                          }}
                        >
                          <div style={{ width: '4px', flexShrink: 0, background: accent }} />
                          <div style={{ padding: '4px 6px', overflow: 'hidden', flex: 1, minWidth: 0, userSelect: 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  color: 'var(--text-primary)',
                                  lineHeight: 1.3,
                                  wordBreak: 'break-word',
                                  overflowWrap: 'anywhere',
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                {getBlockTitle(block)}
                              </div>
                              <span
                                title={block.owner || 'Alice'}
                                style={{ fontSize: '11px', flexShrink: 0, lineHeight: 1 }}
                              >
                                {ownerBadge(block.owner)}
                              </span>
                            </div>
                            {showSubtitle && (
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {formatTimeRange(block.start_time, block.end_time)}
                              </div>
                            )}
                          </div>
                          {/* Resize handles */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: RESIZE_HANDLE_HEIGHT,
                              cursor: 'ns-resize',
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: RESIZE_HANDLE_HEIGHT,
                              cursor: 'ns-resize',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Empty week overlay */}
            {!isLoading && filteredDailyTasks.length === 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: '80px 0 0 56px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  {dailyTasks.length === 0 ? 'No blocks this week' : `No blocks for ${ownerFilter} this week`}
                </p>
                <button
                  type="button"
                  onClick={() => openCreateModal({
                    date: todayStr,
                    start_time: '09:00',
                    end_time: '10:00',
                    title: '',
                    task_id: null,
                  })}
                  style={{
                    pointerEvents: 'auto',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--accent-cyan)',
                    color: 'var(--bg-primary)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginBottom: '12px',
                  }}
                >
                  Create block
                </button>
                {onViewChange && (
                  <button
                    type="button"
                    onClick={() => onViewChange('ai-hub')}
                    style={{
                      pointerEvents: 'auto',
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-cyan)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      textDecoration: 'underline',
                    }}
                  >
                    Go to AI Flow Hub for planning
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {modalState && (
        <BlockModal
          mode={modalState.mode}
          defaultOwner={ownerFilter}
          initial={
            modalState.mode === 'create'
              ? { ...modalState.defaults, owner: modalState.defaults.owner || ownerFilter }
              : {
                  date: modalState.block.date,
                  start_time: modalState.block.start_time,
                  end_time: modalState.block.end_time,
                  title: modalState.block.title || '',
                  task_id: modalState.block.task_id || '',
                  owner: modalState.block.owner || ownerFilter,
                }
          }
          tasks={allTasks}
          onConfirm={handleModalConfirm}
          onCancel={() => {
            setModalState(null);
            setCreatePreview(null);
          }}
        />
      )}
    </div>
  );
}
