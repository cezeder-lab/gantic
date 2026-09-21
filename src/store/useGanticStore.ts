import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Attachment,
  ColumnVisibility,
  Project,
  ProjectTemplate,
  Task,
  TaskSortMode,
  TaskStatus,
  TemplateTask,
  ViewMode,
  ZoomLevel,
} from '../types';
import { PROJECT_COLORS, TASK_COLORS, DEFAULT_COLUMN_VISIBILITY } from '../types';
import { makeId } from '../lib/id';
import { addDays, diffDays, todayISO } from '../lib/dates';
import { getDescendantIds, nextOrder, siblingsOf } from '../lib/taskTree';
import { deleteAttachmentBlobs } from '../lib/attachmentsDb';
import { cascadeDependents } from '../lib/cascade';

interface HistorySnapshot {
  projects: Project[];
  tasks: Task[];
}

interface GanticState {
  projects: Project[];
  tasks: Task[];
  activeProjectId: string | null;
  zoom: ZoomLevel;
  customPxPerDay: number | null;
  selectedTaskId: string | null;
  selectedTaskIds: string[];
  lastClickedTaskId: string | null;
  detailsTaskId: string | null;
  taskSort: TaskSortMode;
  taskFilterQuery: string;
  showCriticalPath: boolean;
  visibleColumns: ColumnVisibility;
  settingsOpen: boolean;
  viewMode: ViewMode;
  templates: ProjectTemplate[];
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // Projects
  createProject: (name: string) => string;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => string;
  importProject: (project: Project, tasks: Task[]) => void;
  setActiveProject: (id: string) => void;
  setProjectColor: (id: string, color: string) => void;
  addProjectMember: (projectId: string, name: string) => void;
  removeProjectMember: (projectId: string, name: string) => void;
  addHoliday: (projectId: string, date: string) => void;
  removeHoliday: (projectId: string, date: string) => void;

  // Templates
  saveAsTemplate: (projectId: string, templateName: string) => void;
  createProjectFromTemplate: (templateId: string, projectName: string, startDate: string) => string;
  deleteTemplate: (templateId: string) => void;

  // Tasks
  addTask: (opts: { parentId?: string | null; afterId?: string; name?: string }) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  duplicateTask: (id: string) => void;
  toggleCollapse: (id: string) => void;
  indentTask: (id: string) => void;
  outdentTask: (id: string) => void;
  moveTaskVertical: (id: string, direction: 'up' | 'down') => void;
  addDependency: (taskId: string, dependsOnId: string) => void;
  removeDependency: (taskId: string, dependsOnId: string) => void;
  addAttachment: (taskId: string, attachment: Attachment) => void;
  removeAttachment: (taskId: string, attachmentId: string) => void;

  // Bulk actions (multi-select)
  bulkSetAssignee: (ids: string[], assignee: string) => void;
  bulkSetStatus: (ids: string[], status: TaskStatus) => void;
  bulkDeleteTasks: (ids: string[]) => void;

  setZoom: (zoom: ZoomLevel) => void;
  setFitToScreen: (zoom: ZoomLevel, pxPerDay: number) => void;
  setSelectedTask: (id: string | null) => void;
  setRangeSelection: (ids: string[], primary: string | null) => void;
  toggleInSelection: (id: string) => void;
  clearSelection: () => void;
  openTaskDetails: (id: string) => void;
  closeTaskDetails: () => void;
  setTaskSort: (mode: TaskSortMode) => void;
  setTaskFilterQuery: (query: string) => void;
  toggleCriticalPath: () => void;
  toggleColumn: (column: keyof ColumnVisibility) => void;
  setSettingsOpen: (open: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  undo: () => void;
  redo: () => void;
}

const HISTORY_BURST_MS = 600;
const MAX_HISTORY = 50;
let lastChangeAt = 0;

/** Snapshots {projects, tasks} onto the undo stack, coalescing rapid bursts
 * (e.g. typing) into a single undo step, and clears the redo stack. */
function recordHistory(get: () => GanticState, set: (partial: Partial<GanticState>) => void) {
  const now = Date.now();
  if (now - lastChangeAt > HISTORY_BURST_MS) {
    const { projects, tasks, past } = get();
    set({ past: [...past.slice(-MAX_HISTORY + 1), { projects, tasks }], future: [] });
  }
  lastChangeAt = now;
}

function seedProject(): { project: Project; tasks: Task[] } {
  const projectId = makeId();
  const today = todayISO();
  const mk = (
    name: string,
    startOffset: number,
    duration: number,
    parentId: string | null,
    order: number,
    extra: Partial<Task> = {},
  ): Task => ({
    id: makeId(),
    projectId,
    name,
    start: addDays(today, startOffset),
    end: addDays(today, startOffset + duration),
    progress: 0,
    parentId,
    order,
    assignee: '',
    color: TASK_COLORS[order % TASK_COLORS.length],
    isMilestone: false,
    collapsed: false,
    dependencies: [],
    description: '',
    attachments: [],
    status: 'not_started',
    ...extra,
  });

  const phase1 = mk('Phase 1 — Scoping', 0, 6, null, 0);
  const t1 = mk('Requirements gathering', 0, 2, phase1.id, 0, {
    progress: 100,
    assignee: 'Mary',
    status: 'done',
  });
  const t2 = mk('Write specification', 2, 3, phase1.id, 1, {
    progress: 60,
    assignee: 'Mary',
    dependencies: [t1.id],
    status: 'in_progress',
  });
  const t3 = mk('Client sign-off', 5, 1, phase1.id, 2, {
    progress: 0,
    assignee: 'Julian',
    dependencies: [t2.id],
  });

  const phase2 = mk('Phase 2 — Delivery', 6, 12, null, 1);
  const t4 = mk('UI mockups', 6, 4, phase2.id, 0, { assignee: 'Sophie', dependencies: [t3.id] });
  const t5 = mk('Development', 10, 6, phase2.id, 1, { assignee: 'Julian', dependencies: [t4.id] });
  const t6 = mk('Testing & QA', 16, 2, phase2.id, 2, { assignee: 'Mary', dependencies: [t5.id] });

  const milestone = mk('Launch', 18, 0, null, 2, { isMilestone: true, color: '#ef5c6e' });

  return {
    project: {
      id: projectId,
      name: 'My first project',
      color: PROJECT_COLORS[0],
      createdAt: Date.now(),
      members: ['Mary', 'Julian', 'Sophie'],
      holidays: [],
    },
    tasks: [phase1, t1, t2, t3, phase2, t4, t5, t6, milestone],
  };
}

const seeded = seedProject();

export const useGanticStore = create<GanticState>()(
  persist(
    (set, get) => ({
      projects: [seeded.project],
      tasks: seeded.tasks,
      activeProjectId: seeded.project.id,
      zoom: 'week',
      customPxPerDay: null,
      selectedTaskId: null,
      selectedTaskIds: [],
      lastClickedTaskId: null,
      detailsTaskId: null,
      taskSort: 'manual',
      taskFilterQuery: '',
      showCriticalPath: false,
      visibleColumns: DEFAULT_COLUMN_VISIBILITY,
      settingsOpen: false,
      viewMode: 'project',
      templates: [],
      past: [],
      future: [],

      createProject: (name) => {
        recordHistory(get, set);
        const id = makeId();
        const project: Project = {
          id,
          name: name.trim() || 'Untitled project',
          color: PROJECT_COLORS[get().projects.length % PROJECT_COLORS.length],
          createdAt: Date.now(),
          members: [],
          holidays: [],
        };
        set((s) => ({ projects: [...s.projects, project], activeProjectId: id }));
        return id;
      },

      renameProject: (id, name) => {
        recordHistory(get, set);
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
        }));
      },

      deleteProject: (id) => {
        recordHistory(get, set);
        set((s) => {
          const tasksToRemove = s.tasks.filter((t) => t.projectId === id);
          deleteAttachmentBlobs(tasksToRemove.flatMap((t) => t.attachments.map((a) => a.id)));

          const projects = s.projects.filter((p) => p.id !== id);
          const tasks = s.tasks.filter((t) => t.projectId !== id);
          const activeProjectId =
            s.activeProjectId === id ? (projects[0]?.id ?? null) : s.activeProjectId;
          return { projects, tasks, activeProjectId };
        });
      },

      duplicateProject: (id) => {
        recordHistory(get, set);
        const state = get();
        const source = state.projects.find((p) => p.id === id);
        if (!source) return id;
        const newProjectId = makeId();
        const idMap = new Map<string, string>();
        const sourceTasks = state.tasks.filter((t) => t.projectId === id);
        for (const t of sourceTasks) idMap.set(t.id, makeId());
        const newTasks: Task[] = sourceTasks.map((t) => ({
          ...t,
          id: idMap.get(t.id)!,
          projectId: newProjectId,
          parentId: t.parentId ? (idMap.get(t.parentId) ?? null) : null,
          dependencies: t.dependencies.map((d) => idMap.get(d)).filter((d): d is string => !!d),
          // Attachment blobs live in IndexedDB keyed by attachment id — duplicated tasks
          // intentionally start without attachments rather than sharing/copying blobs.
          attachments: [],
        }));
        const newProject: Project = {
          id: newProjectId,
          name: `${source.name} (copy)`,
          color: source.color,
          createdAt: Date.now(),
          members: [...source.members],
          holidays: [...source.holidays],
        };
        set((s) => ({
          projects: [...s.projects, newProject],
          tasks: [...s.tasks, ...newTasks],
          activeProjectId: newProjectId,
        }));
        return newProjectId;
      },

      importProject: (project, tasks) => {
        recordHistory(get, set);
        set((s) => ({
          projects: [...s.projects, project],
          tasks: [...s.tasks, ...tasks],
          activeProjectId: project.id,
        }));
      },

      setActiveProject: (id) => set({ activeProjectId: id, selectedTaskId: null }),

      setProjectColor: (id, color) => {
        recordHistory(get, set);
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, color } : p)) }));
      },

      addProjectMember: (projectId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        recordHistory(get, set);
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId && !p.members.includes(trimmed)
              ? { ...p, members: [...p.members, trimmed] }
              : p,
          ),
        }));
      },

      removeProjectMember: (projectId, name) => {
        recordHistory(get, set);
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, members: p.members.filter((m) => m !== name) } : p,
          ),
        }));
      },

      addHoliday: (projectId, date) => {
        recordHistory(get, set);
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId && !p.holidays.includes(date)
              ? { ...p, holidays: [...p.holidays, date].sort() }
              : p,
          ),
        }));
      },

      removeHoliday: (projectId, date) => {
        recordHistory(get, set);
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, holidays: p.holidays.filter((d) => d !== date) } : p,
          ),
        }));
      },

      saveAsTemplate: (projectId, templateName) => {
        const state = get();
        const projectTasks = state.tasks.filter((t) => t.projectId === projectId);
        if (projectTasks.length === 0) return;
        const minStart = projectTasks.reduce((m, t) => (t.start < m ? t.start : m), projectTasks[0].start);

        const templateTasks: TemplateTask[] = projectTasks.map((t) => ({
          id: t.id,
          name: t.name,
          startOffsetDays: diffDays(minStart, t.start),
          durationDays: diffDays(t.start, t.end),
          parentId: t.parentId,
          dependencies: t.dependencies,
          isMilestone: t.isMilestone,
          color: t.color,
        }));

        const template: ProjectTemplate = { id: makeId(), name: templateName.trim() || 'Untitled template', tasks: templateTasks };
        set((s) => ({ templates: [...s.templates, template] }));
      },

      createProjectFromTemplate: (templateId, projectName, startDate) => {
        recordHistory(get, set);
        const template = get().templates.find((t) => t.id === templateId);
        const newProjectId = makeId();
        const idMap = new Map<string, string>();
        if (template) for (const t of template.tasks) idMap.set(t.id, makeId());

        const newTasks: Task[] = (template?.tasks ?? []).map((t, idx) => ({
          id: idMap.get(t.id)!,
          projectId: newProjectId,
          name: t.name,
          start: addDays(startDate, t.startOffsetDays),
          end: addDays(startDate, t.startOffsetDays + t.durationDays),
          progress: 0,
          parentId: t.parentId ? (idMap.get(t.parentId) ?? null) : null,
          order: idx,
          assignee: '',
          color: t.color,
          isMilestone: t.isMilestone,
          collapsed: false,
          dependencies: t.dependencies.map((d) => idMap.get(d)).filter((d): d is string => !!d),
          description: '',
          attachments: [],
          status: 'not_started',
        }));

        const newProject: Project = {
          id: newProjectId,
          name: projectName.trim() || 'Untitled project',
          color: PROJECT_COLORS[get().projects.length % PROJECT_COLORS.length],
          createdAt: Date.now(),
          members: [],
          holidays: [],
        };

        set((s) => ({
          projects: [...s.projects, newProject],
          tasks: [...s.tasks, ...newTasks],
          activeProjectId: newProjectId,
          viewMode: 'project',
        }));
        return newProjectId;
      },

      deleteTemplate: (templateId) => {
        set((s) => ({ templates: s.templates.filter((t) => t.id !== templateId) }));
      },

      addTask: ({ parentId = null, afterId, name = 'New task' }) => {
        recordHistory(get, set);
        const state = get();
        const projectId = state.activeProjectId;
        if (!projectId) return '';
        const id = makeId();
        const today = todayISO();

        let start = today;
        let end = addDays(today, 3);
        let order = nextOrder(state.tasks, projectId, parentId);

        if (afterId) {
          const after = state.tasks.find((t) => t.id === afterId);
          if (after) {
            start = after.end;
            end = addDays(after.end, 3);
            order = after.order + 0.5;
          }
        }

        const task: Task = {
          id,
          projectId,
          name,
          start,
          end,
          progress: 0,
          parentId,
          order,
          assignee: '',
          color: TASK_COLORS[state.tasks.filter((t) => t.projectId === projectId).length % TASK_COLORS.length],
          isMilestone: false,
          collapsed: false,
          dependencies: [],
          description: '',
          attachments: [],
          status: 'not_started',
        };
        set((s) => ({ tasks: [...s.tasks, task], selectedTaskId: id }));
        return id;
      },

      updateTask: (id, patch) => {
        recordHistory(get, set);
        set((s) => {
          let tasks = s.tasks.map((t) => {
            if (t.id !== id) return t;
            const merged = { ...t, ...patch };
            if (merged.end < merged.start) merged.end = merged.start;
            return merged;
          });
          if (patch.start !== undefined || patch.end !== undefined) {
            tasks = cascadeDependents(tasks, id);
          }
          return { tasks };
        });
      },

      deleteTask: (id) => {
        recordHistory(get, set);
        set((s) => {
          const idsToRemove = new Set([id, ...getDescendantIds(s.tasks, id)]);
          const removedTasks = s.tasks.filter((t) => idsToRemove.has(t.id));
          deleteAttachmentBlobs(removedTasks.flatMap((t) => t.attachments.map((a) => a.id)));

          const tasks = s.tasks
            .filter((t) => !idsToRemove.has(t.id))
            .map((t) => ({ ...t, dependencies: t.dependencies.filter((d) => !idsToRemove.has(d)) }));
          return {
            tasks,
            selectedTaskId: s.selectedTaskId && idsToRemove.has(s.selectedTaskId) ? null : s.selectedTaskId,
            detailsTaskId: s.detailsTaskId && idsToRemove.has(s.detailsTaskId) ? null : s.detailsTaskId,
          };
        });
      },

      duplicateTask: (id) => {
        recordHistory(get, set);
        const state = get();
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;

        const subtreeIds = [id, ...getDescendantIds(state.tasks, id)];
        const idMap = new Map<string, string>();
        for (const tid of subtreeIds) idMap.set(tid, makeId());

        const newTasks: Task[] = subtreeIds.map((tid) => {
          const t = state.tasks.find((x) => x.id === tid)!;
          return {
            ...t,
            id: idMap.get(tid)!,
            name: tid === id ? `${t.name} (copy)` : t.name,
            parentId: tid === id ? t.parentId : (idMap.get(t.parentId!) ?? t.parentId),
            order: tid === id ? t.order + 0.5 : t.order,
            // Keep dependencies on tasks outside the duplicated subtree pointing at the
            // originals; only remap links between tasks that were duplicated together.
            dependencies: t.dependencies.map((d) => idMap.get(d) ?? d),
            attachments: [],
          };
        });

        const newRootId = idMap.get(id)!;
        set((s) => ({
          tasks: [...s.tasks, ...newTasks],
          selectedTaskId: newRootId,
          selectedTaskIds: [newRootId],
        }));
      },

      toggleCollapse: (id) => {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, collapsed: !t.collapsed } : t)),
        }));
      },

      indentTask: (id) => {
        recordHistory(get, set);
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return s;
          const siblings = siblingsOf(s.tasks, task).sort((a, b) => a.order - b.order);
          const idx = siblings.findIndex((t) => t.id === id);
          if (idx <= 0) return s;
          const newParent = siblings[idx - 1];
          const newOrder = nextOrder(s.tasks, task.projectId, newParent.id);
          return {
            tasks: s.tasks.map((t) =>
              t.id === id ? { ...t, parentId: newParent.id, order: newOrder } : t,
            ),
          };
        });
      },

      outdentTask: (id) => {
        recordHistory(get, set);
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task || !task.parentId) return s;
          const parent = s.tasks.find((t) => t.id === task.parentId);
          if (!parent) return s;
          const newOrder = parent.order + 0.5;
          return {
            tasks: s.tasks.map((t) =>
              t.id === id ? { ...t, parentId: parent.parentId, order: newOrder } : t,
            ),
          };
        });
      },

      moveTaskVertical: (id, direction) => {
        recordHistory(get, set);
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return s;
          const siblings = siblingsOf(s.tasks, task).sort((a, b) => a.order - b.order);
          const idx = siblings.findIndex((t) => t.id === id);
          const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= siblings.length) return s;
          const other = siblings[swapIdx];
          return {
            tasks: s.tasks.map((t) => {
              if (t.id === task.id) return { ...t, order: other.order };
              if (t.id === other.id) return { ...t, order: task.order };
              return t;
            }),
          };
        });
      },

      addDependency: (taskId, dependsOnId) => {
        if (taskId === dependsOnId) return;
        recordHistory(get, set);
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId && !t.dependencies.includes(dependsOnId)
              ? { ...t, dependencies: [...t.dependencies, dependsOnId] }
              : t,
          ),
        }));
      },

      removeDependency: (taskId, dependsOnId) => {
        recordHistory(get, set);
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, dependencies: t.dependencies.filter((d) => d !== dependsOnId) }
              : t,
          ),
        }));
      },

      addAttachment: (taskId, attachment) => {
        recordHistory(get, set);
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, attachments: [...t.attachments, attachment] } : t,
          ),
        }));
      },

      removeAttachment: (taskId, attachmentId) => {
        recordHistory(get, set);
        deleteAttachmentBlobs([attachmentId]);
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, attachments: t.attachments.filter((a) => a.id !== attachmentId) }
              : t,
          ),
        }));
      },

      bulkSetAssignee: (ids, assignee) => {
        recordHistory(get, set);
        const idSet = new Set(ids);
        set((s) => ({ tasks: s.tasks.map((t) => (idSet.has(t.id) ? { ...t, assignee } : t)) }));
      },

      bulkSetStatus: (ids, status) => {
        recordHistory(get, set);
        const idSet = new Set(ids);
        set((s) => ({ tasks: s.tasks.map((t) => (idSet.has(t.id) ? { ...t, status } : t)) }));
      },

      bulkDeleteTasks: (ids) => {
        recordHistory(get, set);
        set((s) => {
          const idsToRemove = new Set(ids);
          for (const id of ids) for (const d of getDescendantIds(s.tasks, id)) idsToRemove.add(d);
          const removedTasks = s.tasks.filter((t) => idsToRemove.has(t.id));
          deleteAttachmentBlobs(removedTasks.flatMap((t) => t.attachments.map((a) => a.id)));

          const tasks = s.tasks
            .filter((t) => !idsToRemove.has(t.id))
            .map((t) => ({ ...t, dependencies: t.dependencies.filter((d) => !idsToRemove.has(d)) }));
          return {
            tasks,
            selectedTaskId: null,
            selectedTaskIds: [],
            detailsTaskId: s.detailsTaskId && idsToRemove.has(s.detailsTaskId) ? null : s.detailsTaskId,
          };
        });
      },

      setZoom: (zoom) => set({ zoom, customPxPerDay: null }),
      setFitToScreen: (zoom, pxPerDay) => set({ zoom, customPxPerDay: pxPerDay }),
      setSelectedTask: (id) =>
        set({ selectedTaskId: id, selectedTaskIds: id ? [id] : [], lastClickedTaskId: id }),
      setRangeSelection: (ids, primary) => set({ selectedTaskIds: ids, selectedTaskId: primary }),
      toggleInSelection: (id) =>
        set((s) => {
          const has = s.selectedTaskIds.includes(id);
          const next = has ? s.selectedTaskIds.filter((x) => x !== id) : [...s.selectedTaskIds, id];
          return { selectedTaskIds: next, selectedTaskId: id, lastClickedTaskId: id };
        }),
      clearSelection: () => set({ selectedTaskIds: [], selectedTaskId: null }),
      openTaskDetails: (id) => set({ detailsTaskId: id, selectedTaskId: id }),
      closeTaskDetails: () => set({ detailsTaskId: null }),
      setTaskSort: (mode) => set({ taskSort: mode }),
      setTaskFilterQuery: (query) => set({ taskFilterQuery: query }),
      toggleCriticalPath: () => set((s) => ({ showCriticalPath: !s.showCriticalPath })),
      toggleColumn: (column) =>
        set((s) => ({ visibleColumns: { ...s.visibleColumns, [column]: !s.visibleColumns[column] } })),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setViewMode: (mode) => set({ viewMode: mode }),

      undo: () => {
        set((s) => {
          if (s.past.length === 0) return s;
          const previous = s.past[s.past.length - 1];
          return {
            past: s.past.slice(0, -1),
            future: [{ projects: s.projects, tasks: s.tasks }, ...s.future].slice(0, MAX_HISTORY),
            projects: previous.projects,
            tasks: previous.tasks,
          };
        });
      },

      redo: () => {
        set((s) => {
          if (s.future.length === 0) return s;
          const next = s.future[0];
          return {
            future: s.future.slice(1),
            past: [...s.past, { projects: s.projects, tasks: s.tasks }].slice(-MAX_HISTORY),
            projects: next.projects,
            tasks: next.tasks,
          };
        });
      },
    }),
    {
      name: 'gantic-storage',
      version: 3,
      // Undo history and viewport-dependent zoom are ephemeral — no need to
      // persist them across reloads.
      partialize: (state) => {
        const { past: _past, future: _future, customPxPerDay: _customPxPerDay, ...rest } = state;
        return rest;
      },
      // Backfill fields added after the initial release so data saved by earlier
      // versions of the app still loads.
      migrate: (persistedState) => {
        const state = persistedState as
          | (Omit<Partial<GanticState>, 'projects' | 'tasks'> & {
              projects?: Partial<Project>[];
              tasks?: Partial<Task>[];
            })
          | undefined;
        if (!state) return state;
        return {
          ...state,
          visibleColumns: state.visibleColumns ?? DEFAULT_COLUMN_VISIBILITY,
          taskSort: state.taskSort ?? 'manual',
          templates: state.templates ?? [],
          viewMode: state.viewMode ?? 'project',
          selectedTaskIds: state.selectedTaskIds ?? [],
          projects: (state.projects ?? []).map((p) => ({ members: [], holidays: [], ...p }) as Project),
          tasks: (state.tasks ?? []).map(
            (t) =>
              ({
                description: '',
                attachments: [],
                status:
                  t.status ??
                  (t.progress === 100 ? 'done' : t.progress && t.progress > 0 ? 'in_progress' : 'not_started'),
                ...t,
              }) as Task,
          ),
        } as GanticState;
      },
    },
  ),
);
