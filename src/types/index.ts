/** Domain types for Sheraton Charlotte digital signage */

export type UserRole = 'admin' | 'manager' | 'user';

export type AppUser = {
  id: string;
  username: string;
  name?: string;
  role: UserRole;
};

export type UserSession = {
  user: AppUser;
  loggedInAt: string;
};

export type UserDocument = {
  username: string;
  /** Legacy field — older docs may only have this */
  email?: string;
  passwordHash: string;
  name?: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

/** Activity log for account + schedule/org changes */
export type AuditAction =
  | 'event.create'
  | 'event.update'
  | 'event.delete'
  | 'org.logo.upload'
  | 'org.logo.remove'
  | 'org.rename'
  | 'account.create'
  | 'account.update'
  | 'account.role_change'
  | 'account.password_reset'
  | 'account.activate'
  | 'account.deactivate';

export type AuditEntityType = 'event' | 'organization' | 'account' | 'publish' | 'system';

export type AuditStatus = 'staged' | 'live' | 'alert';

export type AuditLogEntry = {
  id: string;
  at: string;
  actorId: string;
  actorUsername: string;
  /** Display name when known (shown as “M. Reyes”) */
  actorName?: string;
  actorRole: UserRole | 'system';
  action: AuditAction | 'publish' | 'screen.offline' | 'import.city';
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  status: AuditStatus;
  /** Extra structured detail for the history UI */
  detail?: Record<string, string | null | undefined>;
};


export type Room = {
  id: string; // stable slug — never changes
  name: string;
  displayName: string;
  bookingAliases: string[];
  sortOrder: number;
  active: boolean;
  /** Set by display tablet while /display/:slug is open */
  screenOnline?: boolean;
  lastSeenAt?: string;
};

export type Organization = {
  id: string;
  name: string;
  displayName: string;
  normalizedName: string;
  aliases: string[];
  logoUrl: string | null;
  createdAt: string;
};

export type EventSource = 'city' | 'manual' | 'delphi'; // delphi = legacy alias

export type SignageEvent = {
  id: string;
  roomId: string;
  orgId: string | null;
  orgNameRaw: string;
  title: string;
  startTime: string; // ISO
  endTime: string; // ISO
  functionType: string;
  source: EventSource;
  display: boolean;
  orderNumber?: string;
  dateKey: string; // YYYY-MM-DD in hotel TZ
  updatedAt: string;
};

/** Denormalized per-room day schedule — one listener per display */
export type DisplayEventSnapshot = {
  id: string;
  orgId: string | null;
  orgName: string;
  orgDisplayName: string;
  logoUrl: string | null;
  title: string;
  startTime: string;
  endTime: string;
  functionType: string;
  source: EventSource;
  display: boolean;
};

export type RoomDisplayDoc = {
  roomId: string;
  name: string;
  displayName: string;
  active: boolean;
  dateKey: string;
  events: DisplayEventSnapshot[];
  updatedAt: string;
};

export type RoomStatus = {
  id: string;
  lastSeenAt: string;
};

export type AppSettings = {
  id: 'app';
  nonDisplayFunctionTypes: string[];
  hotelTimeZone: string;
};

export type ImportSummary = {
  imported: number;
  updated: number;
  deleted: number;
  skipped: { reason: string; count: number }[];
  unmatchedSpaces: string[];
  orgsWithoutLogo: { id: string; name: string }[];
};
