import { useGanticStore } from '../../store/useGanticStore';
import type { Project, Task } from '../../types';
import { getElectronAPI } from '../electronBridge';
import { makeId } from '../id';
import { SyncDoc, entityKey } from './doc';
import type { Overlay, Snapshot } from './doc';
import { diffSnapshots } from './diff';
import type { DraftChange } from './diff';
import { HybridClock } from './hlc';
import { ADMIN_PROJECT_FIELDS, atLeast, normalizeUserId } from './permissions';
import type { Change, Commit, EntityType, PresenceEntry, SyncStatus, WorkspaceConfig } from './types';

const FLUSH_MS = 1000;
const POLL_MS = 2000;
const PRESENCE_WRITE_MS = 15_000;
const PRESENCE_READ_MS = 5_000;
const RETRY_MS = 10_000;
export const PRESENCE_TTL_MS = 2 * 60_000;

type PendingChange = { e: EntityType; id: string; p: string; f: Record<string, unknown>; prev?: Record<string, unknown> };

const CHANGE_ORDER: Record<EntityType, number> = { project: 0, noteTab: 1, task: 2 };

export interface ActivityEntry {
  commit: Commit;
  rejected: Change[] | undefined;
}

/**
 * Keeps the store's projects/tasks in sync with a shared workspace folder:
 *  - local store changes are diffed into field-level changes, checked against
 *    the user's role, held briefly (so a burst of edits becomes one log
 *    entry), then appended to this client's own log file;
 *  - every client's log files are polled, merged into the SyncDoc, and the
 *    merged result is pushed back into the store.
 */
class SyncEngine {
  private config: WorkspaceConfig | null = null;
  private doc = new SyncDoc();
  private clock: HybridClock | null = null;
  private overlay = new Map<string, PendingChange>();
  private lastSynced: Snapshot = { projects: [], tasks: [] };
  private applying = false;
  private ready = false;
  private generation = 0;
  private unsubscribe: (() => void) | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private sending = false;
  private polling = false;
  private listeners = new Set<() => void>();
  private activityVersion = 0;
  private unloadHooked = false;

  async start(config: WorkspaceConfig) {
    await this.stop();
    const gen = ++this.generation;
    this.config = config;
    this.clock = new HybridClock(config.clientId);
    this.doc = new SyncDoc();
    this.overlay.clear();
    this.setStatus('connecting', null);
    this.unsubscribe = useGanticStore.subscribe((state, prev) => this.onStoreChange(state, prev));
    if (!this.unloadHooked) {
      window.addEventListener('beforeunload', () => this.flushSync());
      this.unloadHooked = true;
    }
    await this.connect(gen);
  }

  async stop() {
    this.generation++;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    const api = getElectronAPI();
    if (this.config && api) {
      this.flushSync();
      await api.wsWritePresence(this.config.clientId, this.presenceEntry(0)).catch(() => {});
      await api.wsClose().catch(() => {});
    }
    this.config = null;
    this.ready = false;
    this.overlay.clear();
    useGanticStore.setState({ syncReady: false, presence: [] });
    this.setStatus('off', null);
  }

  private async connect(gen: number) {
    const api = getElectronAPI();
    const config = this.config;
    if (!api || !config) return;
    const res = await api.wsOpen(config.folder);
    if (gen !== this.generation) return;
    if (!res.ok) {
      this.setStatus('offline', `Can't open the workspace folder (${res.error}). Retrying…`);
      this.retryTimer = setTimeout(() => void this.connect(gen), RETRY_MS);
      return;
    }
    let lines: string[];
    try {
      lines = await api.wsReadNew();
    } catch {
      if (gen !== this.generation) return;
      this.setStatus('offline', "Can't read the workspace folder. Retrying…");
      this.retryTimer = setTimeout(() => void this.connect(gen), RETRY_MS);
      return;
    }
    if (gen !== this.generation) return;

    // Anything written while the folder was unreachable last session.
    const unsent = useGanticStore.getState().unsentSyncLines;
    this.ingest([...lines, ...unsent]);
    const state = useGanticStore.getState();
    this.lastSynced = this.doc.materialize({ projects: state.projects, tasks: state.tasks }, this.overlayView());
    this.applyToStore(this.lastSynced, { past: [], future: [] });
    this.ready = true;
    useGanticStore.setState({ syncReady: true, workspaceName: res.name });
    this.setStatus('synced', null);
    void this.send();

    this.timers.push(
      setInterval(() => this.flush(), FLUSH_MS),
      setInterval(() => void this.poll(), POLL_MS),
      setInterval(() => void this.writePresence(), PRESENCE_WRITE_MS),
      setInterval(() => void this.readPresence(), PRESENCE_READ_MS),
    );
    void this.writePresence();
    void this.readPresence();
  }

  // ---- local changes -----------------------------------------------------

  private onStoreChange(
    state: ReturnType<typeof useGanticStore.getState>,
    prev: ReturnType<typeof useGanticStore.getState>,
  ) {
    if (this.applying || !this.config) return;
    if (state.activeProjectId !== prev.activeProjectId && this.ready) void this.writePresence();
    if (state.projects === prev.projects && state.tasks === prev.tasks) return;

    const next: Snapshot = { projects: state.projects, tasks: state.tasks };
    if (!this.ready) {
      this.revert("The team workspace isn't connected yet — changes can't be saved right now.");
      return;
    }
    const drafts = diffSnapshots(this.lastSynced, next);
    if (drafts.length === 0) {
      this.lastSynced = next;
      return;
    }
    const creating = new Set(drafts.filter((d) => this.isNewProject(d)).map((d) => d.change.id));
    if (drafts.some((d) => !this.localAllowed(d.change, creating))) {
      this.revert("You don't have permission to make that change in this project.");
      return;
    }

    let injectedRoles = false;
    for (const d of drafts) {
      if (this.isNewProject(d)) {
        const roles = d.change.f.roles as Record<string, string> | undefined;
        if (!roles || Object.keys(roles).length === 0) {
          d.change.f.roles = { [this.config.userId]: 'admin' };
          d.change.f.defaultRole = d.change.f.defaultRole ?? 'editor';
          injectedRoles = true;
        }
      }
      this.addToOverlay(d);
    }
    this.lastSynced = next;
    if (injectedRoles) this.refreshStore();
    this.setStatus('saving', null);
  }

  private isNewProject(d: DraftChange): boolean {
    return (
      d.change.e === 'project' &&
      !this.doc.has('project', d.change.id) &&
      !this.overlay.has(entityKey('project', d.change.id))
    );
  }

  /** `creating`: projects being created in this same batch — their tasks and
   * notes are the creator's to write. */
  private localAllowed(change: Change, creating: Set<string>): boolean {
    const me = this.config!.userId;
    if (change.e === 'project') {
      if (!this.doc.has('project', change.id)) return true;
      const needsAdmin = Object.keys(change.f).some((k) => ADMIN_PROJECT_FIELDS.has(k));
      return atLeast(this.doc.roleOf(me, change.id), needsAdmin ? 'admin' : 'editor');
    }
    if (!this.doc.has('project', change.p)) {
      return creating.has(change.p) || this.overlay.has(entityKey('project', change.p));
    }
    return atLeast(this.doc.roleOf(me, change.p), 'editor');
  }

  private addToOverlay({ change, all }: DraftChange) {
    const key = entityKey(change.e, change.id);
    const existing = this.overlay.get(key);
    if (existing) {
      Object.assign(existing.f, change.f);
      if (existing.prev && change.prev) {
        for (const [k, v] of Object.entries(change.prev)) if (!(k in existing.prev)) existing.prev[k] = v;
      }
      return;
    }
    if (this.doc.has(change.e, change.id)) {
      const wasDeleted = this.doc.value(change.e, change.id, '_deleted') === true;
      this.overlay.set(key, {
        e: change.e,
        id: change.id,
        p: change.p,
        f: { ...change.f },
        prev: change.prev ?? (wasDeleted ? { _deleted: true } : undefined),
      });
    } else {
      // New to the log: record every field so other clients can build it.
      this.overlay.set(key, {
        e: change.e,
        id: change.id,
        p: change.p,
        f: { ...all, ...change.f, _deleted: change.f._deleted ?? false },
      });
    }
  }

  private overlayView(): Overlay {
    return this.overlay as unknown as Overlay;
  }

  private revert(message: string) {
    this.applyToStore(this.lastSynced, {});
    useGanticStore.getState().showToast(message);
  }

  // ---- writing -----------------------------------------------------------

  private makeCommit(): Commit | null {
    if (!this.config || !this.clock || this.overlay.size === 0) return null;
    const changes = [...this.overlay.values()]
      .sort((a, b) => CHANGE_ORDER[a.e] - CHANGE_ORDER[b.e])
      .map(({ e, id, p, f, prev }) => (prev ? { e, id, p, f, prev } : { e, id, p, f }));
    this.overlay.clear();
    return {
      v: 1,
      id: makeId(),
      ts: this.clock.now(),
      author: { id: this.config.userId, name: this.config.userName },
      client: this.config.clientId,
      changes,
    };
  }

  private flush() {
    if (!this.ready) return;
    const commit = this.makeCommit();
    if (!commit) return;
    this.doc.add([commit]);
    if (this.doc.getRejected(commit.id)) {
      this.refreshStore();
      useGanticStore
        .getState()
        .showToast('Some of your changes were refused — your access to this project may have just changed.');
    }
    this.queueLine(JSON.stringify(commit));
    this.bumpActivity();
    void this.send();
  }

  private queueLine(line: string) {
    const s = useGanticStore.getState();
    useGanticStore.setState({ unsentSyncLines: [...s.unsentSyncLines, line] });
  }

  private async send() {
    const api = getElectronAPI();
    if (!api || !this.config || this.sending) return;
    const batch = useGanticStore.getState().unsentSyncLines;
    if (batch.length === 0) {
      if (this.overlay.size === 0) this.setStatus('synced', null);
      return;
    }
    this.sending = true;
    const gen = this.generation;
    try {
      await api.wsAppend(this.config.clientId, batch);
      if (gen !== this.generation) return;
      const s = useGanticStore.getState();
      useGanticStore.setState({ unsentSyncLines: s.unsentSyncLines.slice(batch.length) });
      if (this.overlay.size === 0 && useGanticStore.getState().unsentSyncLines.length === 0) {
        this.setStatus('synced', null);
      }
    } catch {
      if (gen === this.generation) {
        this.setStatus(
          'offline',
          "Can't write to the workspace folder. Your changes are kept on this computer and will be saved once it's reachable.",
        );
      }
    } finally {
      this.sending = false;
    }
  }

  /** Used while the window closes, when async IPC may never complete. */
  flushSync() {
    const api = getElectronAPI();
    if (!api || !this.config || !this.ready) return;
    const commit = this.makeCommit();
    if (commit) {
      this.doc.add([commit]);
      this.queueLine(JSON.stringify(commit));
    }
    const lines = useGanticStore.getState().unsentSyncLines;
    if (lines.length > 0 && api.wsAppendSync(this.config.clientId, lines)) {
      useGanticStore.setState({ unsentSyncLines: [] });
    }
  }

  // ---- reading -----------------------------------------------------------

  private async poll() {
    const api = getElectronAPI();
    if (!api || !this.ready || this.polling) return;
    this.polling = true;
    const gen = this.generation;
    try {
      const lines = await api.wsReadNew();
      if (gen !== this.generation) return;
      this.ingestRemote(lines);
      if (useGanticStore.getState().syncStatus === 'offline') void this.send();
      if (useGanticStore.getState().unsentSyncLines.length === 0 && this.overlay.size === 0) {
        this.setStatus('synced', null);
      }
    } catch {
      if (gen === this.generation) this.setStatus('offline', "Can't read the workspace folder right now.");
    } finally {
      this.polling = false;
    }
  }

  private parse(lines: string[]): Commit[] {
    const out: Commit[] = [];
    for (const line of lines) {
      try {
        out.push(JSON.parse(line));
      } catch {
        // A damaged line is skipped rather than blocking everything after it.
      }
    }
    return out;
  }

  private ingest(lines: string[]): Commit[] {
    const fresh = this.parse(lines).filter((c) => c && typeof c.id === 'string' && !this.doc.hasSeen(c.id));
    for (const c of fresh) if (typeof c.ts === 'string') this.clock?.observe(c.ts);
    if (fresh.length > 0) {
      this.doc.add(fresh);
      this.bumpActivity();
    }
    return fresh;
  }

  private ingestRemote(lines: string[]) {
    const fresh = this.ingest(lines);
    if (fresh.length === 0) return;

    const touchedTasks = new Set<string>();
    const touchedProjects = new Set<string>();
    for (const c of fresh) {
      for (const ch of c.changes ?? []) {
        if (ch.e === 'task') touchedTasks.add(ch.id);
        else touchedProjects.add(ch.e === 'project' ? ch.id : ch.p);
      }
    }

    const state = useGanticStore.getState();
    const snap = this.doc.materialize({ projects: state.projects, tasks: state.tasks }, this.overlayView());
    this.lastSynced = snap;
    // Undo steps are whole snapshots; carry teammates' changes into them so
    // undoing your own edit never quietly reverts someone else's.
    const rebase = (h: { projects: Project[]; tasks: Task[] }) => ({
      projects: [
        ...h.projects.filter((p) => !touchedProjects.has(p.id)),
        ...snap.projects.filter((p) => touchedProjects.has(p.id)),
      ],
      tasks: [
        ...h.tasks.filter((t) => !touchedTasks.has(t.id)),
        ...snap.tasks.filter((t) => touchedTasks.has(t.id)),
      ],
    });
    this.applyToStore(snap, { past: state.past.map(rebase), future: state.future.map(rebase) });
  }

  private refreshStore() {
    const state = useGanticStore.getState();
    this.lastSynced = this.doc.materialize({ projects: state.projects, tasks: state.tasks }, this.overlayView());
    this.applyToStore(this.lastSynced, {});
  }

  private applyToStore(snap: Snapshot, extra: Partial<ReturnType<typeof useGanticStore.getState>>) {
    const s = useGanticStore.getState();
    const patch: Partial<ReturnType<typeof useGanticStore.getState>> = {
      projects: snap.projects,
      tasks: snap.tasks,
      ...extra,
    };
    if (s.activeProjectId && !snap.projects.some((p) => p.id === s.activeProjectId)) {
      patch.activeProjectId = snap.projects[0]?.id ?? null;
    }
    const taskIds = new Set(snap.tasks.map((t) => t.id));
    if (s.detailsTaskId && !taskIds.has(s.detailsTaskId)) patch.detailsTaskId = null;
    if (s.selectedTaskId && !taskIds.has(s.selectedTaskId)) patch.selectedTaskId = null;
    if (s.selectedTaskIds.some((id) => !taskIds.has(id))) {
      patch.selectedTaskIds = s.selectedTaskIds.filter((id) => taskIds.has(id));
    }
    this.applying = true;
    try {
      useGanticStore.setState(patch);
    } finally {
      this.applying = false;
    }
  }

  // ---- presence ----------------------------------------------------------

  private presenceEntry(lastSeen: number): PresenceEntry {
    return {
      clientId: this.config!.clientId,
      userId: this.config!.userId,
      userName: this.config!.userName,
      projectId: useGanticStore.getState().activeProjectId,
      lastSeen,
    };
  }

  private async writePresence() {
    const api = getElectronAPI();
    if (!api || !this.config || !this.ready) return;
    await api.wsWritePresence(this.config.clientId, this.presenceEntry(Date.now())).catch(() => {});
  }

  private async readPresence() {
    const api = getElectronAPI();
    if (!api || !this.config || !this.ready) return;
    const gen = this.generation;
    const raw = await api.wsReadPresence().catch(() => [] as unknown[]);
    if (gen !== this.generation) return;
    const now = Date.now();
    const presence = (raw as PresenceEntry[]).filter(
      (p) =>
        p &&
        typeof p.clientId === 'string' &&
        typeof p.userName === 'string' &&
        p.clientId !== this.config!.clientId &&
        now - p.lastSeen < PRESENCE_TTL_MS,
    );
    const prev = useGanticStore.getState().presence;
    if (JSON.stringify(prev) !== JSON.stringify(presence)) useGanticStore.setState({ presence });
  }

  // ---- status & activity -------------------------------------------------

  private setStatus(status: SyncStatus, message: string | null) {
    const s = useGanticStore.getState();
    if (s.syncStatus !== status || s.syncMessage !== message) {
      useGanticStore.setState({ syncStatus: status, syncMessage: message });
    }
  }

  private bumpActivity() {
    this.activityVersion++;
    for (const l of this.listeners) l();
  }

  subscribeActivity = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getActivityVersion = () => this.activityVersion;

  getActivity(): ActivityEntry[] {
    return [...this.doc.getCommits()]
      .reverse()
      .map((commit) => ({ commit, rejected: this.doc.getRejected(commit.id) }));
  }

  lookupName = (e: EntityType, id: string): string | undefined => {
    const v = this.doc.value(e, id, e === 'noteTab' ? 'title' : 'name');
    return typeof v === 'string' ? v : undefined;
  };

  /** Names for everyone who has ever written to the workspace or is online. */
  knownUsers(): Map<string, string> {
    const users = new Map<string, string>();
    for (const c of this.doc.getCommits()) users.set(c.author.id, c.author.name);
    for (const p of useGanticStore.getState().presence) users.set(p.userId, p.userName);
    if (this.config) users.set(this.config.userId, this.config.userName);
    return users;
  }
}

export const syncEngine = new SyncEngine();

export async function joinWorkspace(folder: string, userName: string, email: string): Promise<string | null> {
  const api = getElectronAPI();
  if (!api) return 'Team workspaces need the desktop app.';
  const res = await api.wsOpen(folder);
  if (!res.ok) return res.error;
  const s = useGanticStore.getState();
  const config: WorkspaceConfig = {
    folder,
    userId: normalizeUserId(email),
    userName: userName.trim(),
    clientId: makeId(),
  };
  // Park this computer's own projects; they come back on leaving, and can
  // be copied into the workspace from Settings.
  useGanticStore.setState({
    workspace: config,
    localSnapshot: s.localSnapshot ?? { projects: s.projects, tasks: s.tasks },
    projects: [],
    tasks: [],
    past: [],
    future: [],
    activeProjectId: null,
    unsentSyncLines: [],
  });
  await syncEngine.start(config);
  return null;
}

export async function leaveWorkspace() {
  await syncEngine.stop();
  const s = useGanticStore.getState();
  const projects = s.localSnapshot?.projects ?? [];
  useGanticStore.setState({
    workspace: null,
    workspaceName: null,
    projects,
    tasks: s.localSnapshot?.tasks ?? [],
    localSnapshot: null,
    activeProjectId: projects[0]?.id ?? null,
    past: [],
    future: [],
    unsentSyncLines: [],
  });
}

/** Copies this computer's own projects (and their attachment files) into the
 * workspace; the importer becomes their admin. Returns how many were added. */
export async function importLocalProjects(): Promise<number> {
  const api = getElectronAPI();
  const s = useGanticStore.getState();
  if (!api || !s.workspace || !s.localSnapshot) return 0;
  const existing = new Set(s.projects.map((p) => p.id));
  const toImport = s.localSnapshot.projects.filter((p) => !existing.has(p.id));
  if (toImport.length === 0) return 0;
  const ids = new Set(toImport.map((p) => p.id));
  const tasks = s.localSnapshot.tasks.filter((t) => ids.has(t.projectId));
  await api.wsImportAttachments(tasks.flatMap((t) => t.attachments.map((a) => a.id)));
  const me = s.workspace.userId;
  useGanticStore.setState({
    projects: [...s.projects, ...toImport.map((p) => ({ ...p, roles: { [me]: 'admin' as const }, defaultRole: 'editor' as const }))],
    tasks: [...s.tasks, ...tasks],
    activeProjectId: s.activeProjectId ?? toImport[0].id,
  });
  return toImport.length;
}
