/** Schematic floor-plan layouts for the admin hub (traced from hotel plans). */

export type FloorId = 'first' | 'second' | 'lobby';

export type FloorMeta = {
  id: FloorId;
  label: string;
  blurb: string;
  roomIds: string[];
};

export type DirectoryMarker = {
  id: string;
  label: string;
  /** Optional link target for lobby presence doc / display URL */
  href?: string;
};

export const FLOORS: FloorMeta[] = [
  {
    id: 'first',
    label: 'First floor',
    blurb:
      'Traced from the hotel floor plans; lobby outlets and rooftop remain schematic.',
    roomIds: [
      'symphony-1',
      'symphony-2',
      'symphony-3',
      'symphony-4',
      'symphony-5',
      'symphony-6',
      'symphony-7',
      'mecklenburg-1',
      'mecklenburg-2',
      'mecklenburg-3',
      'carolina-a',
      'carolina-c',
      'carolina-d',
      'carolina-e',
      'governors-1',
      'governors-2',
      'governors-3',
      'governors-4',
      'governors-5',
      'governors-6',
    ],
  },
  {
    id: 'second',
    label: 'Second floor',
    blurb:
      'Traced from the hotel floor plans; lobby outlets and rooftop remain schematic.',
    roomIds: [
      'executive-boardroom',
      'boardroom',
      'cardinal-1',
      'cardinal-2',
      'cardinal-3',
    ],
  },
  {
    id: 'lobby',
    label: 'Lobby & rooftop',
    blurb:
      'Traced from the hotel floor plans; lobby outlets and rooftop remain schematic.',
    roomIds: [
      'craft-city',
      'piedmont-room',
      'tannin-toast-back',
      'tannin-toast-pdr',
      'cjs',
      'rooftop-parlor',
      'rooftop-patio',
    ],
  },
];

export const FLOOR_DIRECTORIES: Record<FloorId, DirectoryMarker[]> = {
  first: [
    { id: 'dir-governors', label: "Governor's directory" },
    { id: 'dir-symphony', label: 'Symphony directory' },
  ],
  second: [
    { id: 'dir-cardinal', label: 'Cardinal directory (proposed)' },
  ],
  lobby: [
    { id: 'dir-elevator', label: 'Main elevator bank directory' },
    { id: 'dir-lobby', label: 'Lobby directory', href: '/display/lobby' },
  ],
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/** Short mark drawn on the tile (Roman / letter / number). */
export function roomMark(roomId: string): string | null {
  const sym = roomId.match(/^symphony-(\d)$/);
  if (sym) return ROMAN[Number(sym[1]) - 1] ?? sym[1];
  const num = roomId.match(/^(?:mecklenburg|governors|cardinal)-(\d)$/);
  if (num) return num[1];
  const letter = roomId.match(/^carolina-([a-z])$/);
  if (letter) return letter[1].toUpperCase();
  return null;
}

/** Compact label for crowded tiles. */
export function shortRoomLabel(displayName: string, roomId: string): string {
  if (roomId.startsWith('symphony-')) {
    const mark = roomMark(roomId);
    return mark ? `Symphony ${mark}` : displayName;
  }
  if (roomId.startsWith('carolina-')) {
    const mark = roomMark(roomId);
    return mark ? `Carolina ${mark}` : displayName;
  }
  if (roomId.startsWith('mecklenburg-')) {
    const mark = roomMark(roomId);
    return mark ? `Mecklenburg ${mark}` : displayName;
  }
  if (roomId.startsWith('governors-')) {
    const mark = roomMark(roomId);
    return mark ? `Gov ${mark}` : displayName;
  }
  if (roomId === 'tannin-toast-back') return 'Tannin & Toast (Back Half)';
  if (roomId === 'tannin-toast-pdr') return 'Tannin & Toast PDR';
  return displayName;
}
