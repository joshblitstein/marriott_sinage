import type { TemplateBox, TemplateLayout } from '../types/templates';

function box(
  kind: TemplateBox['kind'],
  x: number,
  y: number,
  w: number,
  h: number,
  extra?: Partial<TemplateBox>,
): TemplateBox {
  return {
    id: `${kind}_${Math.round(x)}_${Math.round(y)}`,
    kind,
    x,
    y,
    w,
    h,
    ...extra,
  };
}

/** Layout inspired by existing DoorClassic (flat ballroom door). */
export function classicLayoutElements(): TemplateBox[] {
  return [
    box('brand', 3, 3, 26, 10),
    box('roomName', 3, 14, 46, 11, { fontSize: 68, fontWeight: 300 }),
    box('orgLogo', 3, 28, 10, 18),
    box('orgName', 15, 28, 34, 10, { fontSize: 40, fontWeight: 300 }),
    box('timeRange', 15, 39, 34, 5, { fontSize: 26 }),
    box('eventTitle', 15, 45, 34, 6, { fontSize: 24 }),
    box('nextUp', 3, 68, 46, 8, { fontSize: 24 }),
    box('scheduleList', 52, 14, 45, 70, { fontSize: 30 }),
    box('footer', 3, 90, 94, 6, { fontSize: 20 }),
  ];
}

/** Layout inspired by existing DoorCards (panel-based). */
export function cardsLayoutElements(): TemplateBox[] {
  return [
    box('brand', 3, 3, 26, 8),
    box('clock', 78, 3.5, 19, 6, { textAlign: 'right', fontSize: 28 }),
    box('level', 3, 11, 30, 5, { fontSize: 20 }),
    box('roomName', 3, 16, 46, 10, { fontSize: 60, fontWeight: 300 }),
    box('orgName', 5, 30, 42, 8, { fontSize: 38, fontWeight: 300 }),
    box('timeRange', 5, 40, 42, 5, { fontSize: 24 }),
    box('eventTitle', 5, 46, 42, 5, { fontSize: 22 }),
    box('orgLogo', 5, 54, 12, 18),
    box('nextUp', 5, 76, 42, 6, { fontSize: 22 }),
    box('scheduleList', 52, 26, 45, 56, { fontSize: 28 }),
    box('footer', 3, 90, 94, 6, { fontSize: 20 }),
  ];
}

/** Layout inspired by DoorEmpty — idle / no-event room sign. */
export function idleLayoutElements(): TemplateBox[] {
  return [
    box('brand', 22, 24, 56, 16, { textAlign: 'center' }),
    box('roomName', 8, 48, 84, 18, {
      textAlign: 'center',
      fontSize: 92,
      fontWeight: 300,
    }),
    box('level', 20, 70, 60, 8, { textAlign: 'center', fontSize: 30 }),
  ];
}

export function layoutFromElements(elements: TemplateBox[]): TemplateLayout {
  return { elements, updatedAt: new Date().toISOString() };
}

export const SAMPLE_PREVIEW_DATA = {
  roomName: 'Symphony 1',
  level: 'Level 2',
  orgDisplayName: 'Charlotte Touchdown Club',
  logoUrl: null as string | null,
  eventTitle: 'Lunch Buffet',
  timeRange: '12:00 PM – 3:00 PM',
  nextUp: 'Next 3:30 PM · Board Meeting',
  scheduleLines: [
    '12:00 PM – 1:00 PM · In House Meetings',
    '12:00 PM – 3:00 PM · Charlotte Touchdown Club',
    '3:30 PM – 5:00 PM · Board Meeting',
  ],
  footerLeft: 'Thursday, September 24, 2026',
  footerRight: 'Restrooms and elevators to the right',
  nowClock: '9:42 AM',
  nowDate: 'Thursday, September 24, 2026',
  weatherTemp: '72°',
  weatherLabel: 'Partly cloudy',
  weatherLine: '72° · Partly cloudy',
  weatherHumidity: '48% humidity',
};

export const SAMPLE_IDLE_PREVIEW_DATA = {
  ...SAMPLE_PREVIEW_DATA,
  orgDisplayName: '',
  eventTitle: '',
  timeRange: '',
  nextUp: '',
  scheduleLines: [] as string[],
};
