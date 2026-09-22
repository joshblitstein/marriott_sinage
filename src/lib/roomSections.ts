import type { Room } from '../types';

export type RoomSection = {
  id: string;
  title: string;
  level: string;
  rooms: Room[];
};

const SECTION_DEFS: {
  id: string;
  title: string;
  level: string;
  match: (room: Room) => boolean;
}[] = [
  {
    id: 'symphony',
    title: 'Symphony Ballroom',
    level: 'Ballroom level',
    match: (r) => r.id.startsWith('symphony-') && !r.id.includes('foyer'),
  },
  {
    id: 'mecklenburg',
    title: 'Mecklenburg',
    level: 'Ballroom level',
    match: (r) => r.id.startsWith('mecklenburg-') && !r.id.includes('foyer'),
  },
  {
    id: 'carolina',
    title: 'Carolina',
    level: 'Meeting level',
    match: (r) => r.id.startsWith('carolina-') && !r.id.includes('foyer'),
  },
  {
    id: 'governors',
    title: "Governor's",
    level: 'Meeting level',
    match: (r) => r.id.startsWith('governors-') && !r.id.includes('foyer'),
  },
  {
    id: 'cardinal',
    title: 'Cardinal',
    level: 'Meeting level',
    match: (r) => r.id.startsWith('cardinal-') && !r.id.includes('foyer'),
  },
  {
    id: 'boardrooms',
    title: 'Boardrooms',
    level: 'Meeting level',
    match: (r) => r.id === 'executive-boardroom' || r.id === 'boardroom',
  },
  {
    id: 'social',
    title: 'Social & dining',
    level: 'Lobby level',
    match: (r) =>
      [
        'craft-city',
        'piedmont-room',
        'tannin-toast-back',
        'tannin-toast-pdr',
        'rooftop-parlor',
        'rooftop-patio',
        'cjs',
        'lower-symphony-lounge',
      ].includes(r.id),
  },
];

export function groupRoomsBySection(rooms: Room[]): RoomSection[] {
  const used = new Set<string>();
  const sections: RoomSection[] = [];

  for (const def of SECTION_DEFS) {
    const matched = rooms.filter((r) => def.match(r));
    if (matched.length === 0) continue;
    matched.forEach((r) => used.add(r.id));
    sections.push({
      id: def.id,
      title: def.title,
      level: def.level,
      rooms: matched,
    });
  }

  const leftover = rooms.filter((r) => !used.has(r.id));
  if (leftover.length > 0) {
    sections.push({
      id: 'other',
      title: 'Other spaces',
      level: 'Hotel',
      rooms: leftover,
    });
  }

  return sections;
}
