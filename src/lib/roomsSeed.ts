/**
 * Canonical room inventory + combination-space mappings for Sheraton Charlotte.
 * Slugs are permanent. bookingAliases are stored in normalized form for matching.
 */
import { normalizeSpaceName } from './normalize';

export type RoomSeed = {
  id: string;
  name: string;
  displayName: string;
  bookingAliases: string[];
  sortOrder: number;
  active: boolean;
};

function alias(...names: string[]): string[] {
  const set = new Set(names.map(normalizeSpaceName).filter(Boolean));
  return [...set];
}

function numbered(
  prefix: string,
  slugPrefix: string,
  count: number,
  startOrder: number,
  active = true,
): RoomSeed[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      id: `${slugPrefix}-${n}`,
      name: `${prefix} ${n}`,
      displayName: `${prefix} ${n}`,
      bookingAliases: alias(`${prefix} ${n}`),
      sortOrder: startOrder + i,
      active,
    };
  });
}

function lettered(
  prefix: string,
  slugPrefix: string,
  letters: string[],
  startOrder: number,
): RoomSeed[] {
  return letters.map((letter, i) => ({
    id: `${slugPrefix}-${letter.toLowerCase()}`,
    name: `${prefix} ${letter}`,
    displayName: `${prefix} ${letter}`,
    bookingAliases: alias(`${prefix} ${letter}`),
    sortOrder: startOrder + i,
    active: true,
  }));
}

/** Add aliases to every member room id */
function addAliases(
  rooms: Map<string, RoomSeed>,
  memberIds: string[],
  names: string[],
) {
  const normalized = alias(...names);
  for (const id of memberIds) {
    const room = rooms.get(id);
    if (!room) throw new Error(`Missing room ${id}`);
    room.bookingAliases = alias(...room.bookingAliases, ...normalized);
  }
}

function comboLabel(prefix: string, parts: (string | number)[]): string[] {
  const joined = parts.join(',');
  const spaced = parts.join(', ');
  const amped =
    parts.length === 2
      ? `${parts[0]} & ${parts[1]}`
      : `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}`;
  return [
    `${prefix} ${joined}`,
    `${prefix} ${spaced}`,
    `${prefix} ${amped}`,
  ];
}

export function buildRoomSeeds(): RoomSeed[] {
  const list: RoomSeed[] = [
    ...numbered('Symphony', 'symphony', 7, 10),
    ...numbered('Mecklenburg', 'mecklenburg', 3, 20),
    ...lettered('Carolina', 'carolina', ['A', 'C', 'D', 'E'], 30),
    ...numbered("Governor's", 'governors', 6, 40),
    ...numbered('Cardinal', 'cardinal', 3, 50),
    {
      id: 'executive-boardroom',
      name: 'Executive Boardroom',
      displayName: 'Executive Boardroom',
      bookingAliases: alias('Executive Boardroom'),
      sortOrder: 60,
      active: true,
    },
    {
      id: 'boardroom',
      name: 'Boardroom',
      displayName: 'Boardroom',
      bookingAliases: alias('Boardroom'),
      sortOrder: 61,
      active: true,
    },
    {
      id: 'craft-city',
      name: 'Craft City',
      displayName: 'Craft City',
      bookingAliases: alias('Craft City', 'Craft City Social Club'),
      sortOrder: 62,
      active: true,
    },
    {
      id: 'piedmont-room',
      name: 'Piedmont Room',
      displayName: 'Piedmont Room',
      bookingAliases: alias('Piedmont Room', 'Piedmont'),
      sortOrder: 63,
      active: true,
    },
    {
      id: 'lower-symphony-lounge',
      name: 'Lower Symphony Lounge',
      displayName: 'Lower Symphony Lounge',
      bookingAliases: alias('Lower Symphony Lounge', 'Symphony Lounge'),
      sortOrder: 69,
      active: true,
    },
    {
      id: 'tannin-toast-back',
      name: 'Tannin & Toast (Back Half)',
      displayName: 'Tannin & Toast (Back Half)',
      bookingAliases: alias(
        'Tannin & Toast (Back Half)',
        'Tannin and Toast (Back Half)',
        'Tannin & Toast Back Half',
      ),
      sortOrder: 64,
      active: true,
    },
    {
      id: 'tannin-toast-pdr',
      name: 'Tannin & Toast PDR',
      displayName: 'Tannin & Toast PDR',
      bookingAliases: alias('Tannin & Toast PDR', 'Tannin and Toast PDR'),
      sortOrder: 65,
      active: true,
    },
    {
      id: 'rooftop-parlor',
      name: 'Rooftop Parlor',
      displayName: 'Rooftop Parlor',
      bookingAliases: alias('Rooftop Parlor'),
      sortOrder: 66,
      active: true,
    },
    {
      id: 'rooftop-patio',
      name: 'Rooftop Patio',
      displayName: 'Rooftop Patio',
      bookingAliases: alias('Rooftop Patio'),
      sortOrder: 67,
      active: true,
    },
    {
      id: 'cjs',
      name: 'CJs',
      displayName: 'CJs',
      bookingAliases: alias('CJs', 'CJ\'s', 'CJs Restaurant'),
      sortOrder: 68,
      active: true,
    },
    // Foyers — inactive by default
    {
      id: 'symphony-foyer',
      name: 'Symphony Ballroom Foyer',
      displayName: 'Symphony Ballroom Foyer',
      bookingAliases: alias(
        'Symphony Ballroom Foyer',
        'Symphony Convention Foyer',
        'Symphony Foyer',
      ),
      sortOrder: 100,
      active: false,
    },
    {
      id: 'governors-foyer',
      name: "Governor's Foyer",
      displayName: "Governor's Foyer",
      bookingAliases: alias("Governor's Foyer", 'Governors Foyer'),
      sortOrder: 101,
      active: false,
    },
    {
      id: 'cardinal-foyer',
      name: 'Cardinal Foyer',
      displayName: 'Cardinal Foyer',
      bookingAliases: alias('Cardinal Foyer'),
      sortOrder: 102,
      active: false,
    },
    {
      id: 'carolina-mecklenburg-foyer',
      name: 'Carolina Mecklenburg Foyer',
      displayName: 'Carolina Mecklenburg Foyer',
      bookingAliases: alias(
        'Carolina Mecklenburg Foyer',
        'Mecklenburg Ballroom Foyer',
        'Mecklenburg Foyer',
        'Convention/Carolina Ballroom Foyer',
        'Convention Carolina Ballroom Foyer',
        'Carolina Ballroom Foyer',
      ),
      sortOrder: 103,
      active: false,
    },
    {
      id: 'craft-city-pool-foyer',
      name: 'Craft City Social Club Pool & Bar Foyer',
      displayName: 'Craft City Social Club Pool & Bar Foyer',
      bookingAliases: alias(
        'Craft City Social Club Pool & Bar Foyer',
        'Craft City Pool Foyer',
      ),
      sortOrder: 104,
      active: false,
    },
  ];

  const rooms = new Map(list.map((r) => [r.id, r]));

  // Named ballrooms → member rooms
  addAliases(
    rooms,
    ['symphony-1', 'symphony-2', 'symphony-3', 'symphony-4', 'symphony-5', 'symphony-6', 'symphony-7'],
    ['Symphony Ballroom', 'Symphony'],
  );
  addAliases(
    rooms,
    ['mecklenburg-1', 'mecklenburg-2', 'mecklenburg-3'],
    ['Mecklenburg Ballroom', 'Mecklenburg'],
  );
  addAliases(
    rooms,
    ['carolina-a', 'carolina-c', 'carolina-d', 'carolina-e'],
    ['Carolina Ballroom', 'Carolina'],
  );
  addAliases(
    rooms,
    ['governors-1', 'governors-2', 'governors-3', 'governors-4', 'governors-5', 'governors-6'],
    ["Governor's Ballroom", 'Governors Ballroom', "Governor's", 'Governors'],
  );
  addAliases(
    rooms,
    ['cardinal-1', 'cardinal-2', 'cardinal-3'],
    ['Cardinal Ballroom', 'Cardinal'],
  );

  // Numbered combinations
  const symphonyCombos: number[][] = [
    [1, 2],
    [2, 3],
    [1, 2, 3],
    [1, 2, 3, 4],
    [5, 6],
    [6, 7],
    [5, 6, 7],
    [4, 5, 6, 7],
  ];
  for (const parts of symphonyCombos) {
    addAliases(
      rooms,
      parts.map((n) => `symphony-${n}`),
      comboLabel('Symphony', parts),
    );
  }

  for (const parts of [
    [1, 2],
    [2, 3],
  ]) {
    addAliases(
      rooms,
      parts.map((n) => `mecklenburg-${n}`),
      comboLabel('Mecklenburg', parts),
    );
  }

  const carolinaCombos: string[][] = [
    ['A', 'C'],
    ['D', 'E'],
    ['C', 'D', 'E'],
  ];
  for (const parts of carolinaCombos) {
    addAliases(
      rooms,
      parts.map((l) => `carolina-${l.toLowerCase()}`),
      comboLabel('Carolina', parts),
    );
  }

  const governorsCombos: number[][] = [
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [1, 2, 3],
    [2, 3, 4],
    [3, 4, 5],
    [4, 5, 6],
    [1, 2, 3, 4],
    [2, 3, 4, 5],
    [3, 4, 5, 6],
    [2, 3, 4, 5, 6],
    [1, 2, 3, 4, 5],
  ];
  for (const parts of governorsCombos) {
    addAliases(
      rooms,
      parts.map((n) => `governors-${n}`),
      [
        ...comboLabel("Governor's", parts),
        ...comboLabel('Governors', parts),
      ],
    );
  }

  for (const parts of [
    [1, 2],
    [2, 3],
  ]) {
    addAliases(
      rooms,
      parts.map((n) => `cardinal-${n}`),
      comboLabel('Cardinal', parts),
    );
  }

  return [...rooms.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function resolveRoomsForSpace(
  spaceName: string,
  rooms: { id: string; bookingAliases?: string[] }[],
): string[] {
  const key = normalizeSpaceName(spaceName);
  if (!key) return [];
  return rooms
    .filter((r) => (r.bookingAliases ?? []).includes(key))
    .map((r) => r.id);
}
