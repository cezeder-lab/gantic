export type EntityType = 'project' | 'noteTab' | 'task';

export interface Author {
  id: string; // email, lowercased — the identity roles are keyed by
  name: string;
}

/** One entity's field-level update inside a commit. `_deleted` is just
 * another field, so deletes and restores merge like any other edit. */
export interface Change {
  e: EntityType;
  id: string;
  p: string; // project the entity belongs to (its own id for projects)
  f: Record<string, unknown>;
  prev?: Record<string, unknown>; // values before the change, for the audit log
}

/** One line in a client's append-only log file. */
export interface Commit {
  v: 1;
  id: string;
  ts: string; // hybrid logical clock stamp, lexicographically ordered
  author: Author;
  client: string;
  changes: Change[];
}

export interface WorkspaceConfig {
  folder: string;
  userId: string;
  userName: string;
  clientId: string;
}

export type SyncStatus = 'off' | 'connecting' | 'synced' | 'saving' | 'offline';

export interface PresenceEntry {
  clientId: string;
  userId: string;
  userName: string;
  projectId: string | null;
  lastSeen: number;
}
