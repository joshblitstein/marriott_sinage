import { doc, setDoc, type Firestore } from 'firebase/firestore';
import type {
  AppUser,
  AuditAction,
  AuditEntityType,
  AuditLogEntry,
  AuditStatus,
} from '../types';

export type AuditWriteInput = {
  actor: AppUser;
  action: AuditAction | 'publish' | 'screen.offline' | 'import.city';
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  status?: AuditStatus;
  detail?: Record<string, string | null | undefined>;
};

function defaultStatus(
  action: AuditWriteInput['action'],
): AuditStatus {
  if (action === 'screen.offline') return 'alert';
  if (
    action === 'event.create' ||
    action === 'event.update' ||
    action === 'event.delete'
  ) {
    return 'staged';
  }
  return 'live';
}

/** Persist an activity-log row. Failures are swallowed so UI mutations still succeed. */
export async function writeAuditLog(
  db: Firestore,
  input: AuditWriteInput,
): Promise<void> {
  const at = new Date().toISOString();
  const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: AuditLogEntry = {
    id,
    at,
    actorId: input.actor.id,
    actorUsername: input.actor.username,
    ...(input.actor.name ? { actorName: input.actor.name } : {}),
    actorRole: input.actor.role,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    status: input.status ?? defaultStatus(input.action),
    ...(input.detail ? { detail: input.detail } : {}),
  };

  try {
    await setDoc(doc(db, 'auditLogs', id), entry);
  } catch (err) {
    console.warn('audit log write failed', err);
  }
}
