import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, Task, ZoomLevel } from '../types';
import { PROJECT_COLORS, TASK_COLORS } from '../types';
import { makeId } from '../lib/id';
import { addDays, todayISO } from '../lib/dates';
import { getDescendantIds, nextOrder, siblingsOf } from '../lib/taskTree';

interface GanticState {
  projects: Project[];
  tasks: Task[];
  activeProjectId: string | null;
  zoom: ZoomLevel;
  selectedTaskId: string | null;

  // Projects
  createProject: (name: string) => string;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => string;
  setActiveProject: (id: string) => void;
  setProjectColor: (id: string, color: string) => void;

  // Tasks
  addTask: (opts: { parentId?: string | null; afterId?: string; name?: string }) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleCollapse: (id: string) => void;
  indentTask: (id: string) => void;
  outdentTask: (id: string) => void;
  moveTaskVertical: (id: string, direction: 'up' | 'down') => void;
  addDependency: (taskId: string, dependsOnId: string) => void;
  removeDependency: (taskId: string, dependsOnId: string) => void;

  setZoom: (zoom: ZoomLevel) => void;
  setSelectedTask: (id: string | null) => void;
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
    ...extra,
  });

  const phase1 = mk('Phase 1 — Cadrage', 0, 6, null, 0);
  const t1 = mk('Recueil des besoins', 0, 2, phase1.id, 0, { progress: 100, assignee: 'Marie' });
  const t2 = mk('Rédaction du cahier des charges', 2, 3, phase1.id, 1, {
    progress: 60,
    assignee: 'Marie',
    dependencies: [t1.id],
  });
  const t3 = mk('Validation client', 5, 1, phase1.id, 2, {
    progress: 0,
    assignee: 'Julien',
    dependencies: [t2.id],
  });

  const phase2 = mk('Phase 2 — Réalisation', 6, 12, null, 1);
  const t4 = mk('Maquettes UI', 6, 4, phase2.id, 0, { assignee: 'Sophie', dependencies: [t3.id] });
  const t5 = mk('Développement', 10, 6, phase2.id, 1, { assignee: 'Julien', dependencies: [t4.id] });
  const t6 = mk('Tests & recette', 16, 2, phase2.id, 2, { assignee: 'Marie', dependencies: [t5.id] });

  const milestone = mk('Lancement', 18, 0, null, 2, { isMilestone: true, color: '#ef5c6e' });

  return {
    project: { id: projectId, name: 'Mon premier projet', color: PROJECT_COLORS[0], createdAt: Date.now() },
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
      selectedTaskId: null,

      createProject: (name) => {
        const id = makeId();
        const project: Project = {
          id,
          name: name.trim() || 'Projet sans titre',
          color: PROJECT_COLORS[get().projects.length % PROJECT_COLORS.length],
          createdAt: Date.now(),
        };
        set((s) => ({ projects: [...s.projects, project], activeProjectId: id }));
        return id;
      },

      renameProject: (id, name) => {
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
        }));
      },

      deleteProject: (id) => {
        set((s) => {
          const projects = s.projects.filter((p) => p.id !== id);
          const tasks = s.tasks.filter((t) => t.projectId !== id);
          const activeProjectId =
            s.activeProjectId === id ? (projects[0]?.id ?? null) : s.activeProjectId;
          return { projects, tasks, activeProjectId };
        });
      },

      duplicateProject: (id) => {
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
        }));
        const newProject: Project = {
          id: newProjectId,
          name: `${source.name} (copie)`,
          color: source.color,
          createdAt: Date.now(),
        };
        set((s) => ({
          projects: [...s.projects, newProject],
          tasks: [...s.tasks, ...newTasks],
          activeProjectId: newProjectId,
        }));
        return newProjectId;
      },

      setActiveProject: (id) => set({ activeProjectId: id, selectedTaskId: null }),

      setProjectColor: (id, color) => {
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, color } : p)) }));
      },

      addTask: ({ parentId = null, afterId, name = 'Nouvelle tâche' }) => {
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
        };
        set((s) => ({ tasks: [...s.tasks, task], selectedTaskId: id }));
        return id;
      },

      updateTask: (id, patch) => {
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const merged = { ...t, ...patch };
            if (merged.end < merged.start) merged.end = merged.start;
            return merged;
          }),
        }));
      },

      deleteTask: (id) => {
        set((s) => {
          const idsToRemove = new Set([id, ...getDescendantIds(s.tasks, id)]);
          const tasks = s.tasks
            .filter((t) => !idsToRemove.has(t.id))
            .map((t) => ({ ...t, dependencies: t.dependencies.filter((d) => !idsToRemove.has(d)) }));
          return {
            tasks,
            selectedTaskId: s.selectedTaskId && idsToRemove.has(s.selectedTaskId) ? null : s.selectedTaskId,
          };
        });
      },

      toggleCollapse: (id) => {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, collapsed: !t.collapsed } : t)),
        }));
      },

      indentTask: (id) => {
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
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId && !t.dependencies.includes(dependsOnId)
              ? { ...t, dependencies: [...t.dependencies, dependsOnId] }
              : t,
          ),
        }));
      },

      removeDependency: (taskId, dependsOnId) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, dependencies: t.dependencies.filter((d) => d !== dependsOnId) }
              : t,
          ),
        }));
      },

      setZoom: (zoom) => set({ zoom }),
      setSelectedTask: (id) => set({ selectedTaskId: id }),
    }),
    { name: 'gantic-storage' },
  ),
);
