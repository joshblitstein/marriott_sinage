/** Domain types for Sheraton Charlotte digital signage */

export type AppUser = {
  id: string;
  username: string;
  name?: string;
  role: 'admin' | 'manager';
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
  role: 'admin' | 'manager';
  active: boolean;
  createdAt: string;
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
