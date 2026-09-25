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
    box('brand', 3, 3, 28, 8),
    box('level', 72, 3.5, 25, 6, { textAlign: 'right', fontSize: 22 }),
    box('roomName', 3, 14, 48, 12, { fontSize: 72, fontWeight: 700 }),
    box('orgLogo', 3, 30, 12, 22),
    box('orgName', 17, 30, 40, 8, { fontSize: 48, fontWeight: 700 }),
    box('timeRange', 17, 39, 40, 6, { fontSize: 28 }),
    box('eventTitle', 17, 46, 40, 6, { fontSize: 26 }),
    box('nextUp', 3, 58, 48, 8, { fontSize: 24 }),
    box('scheduleList', 54, 14, 43, 70, { fontSize: 22 }),
    box('footer', 3, 90, 94, 6, { fontSize: 20 }),
  ];
}

/** Layout inspired by existing DoorCards (panel-based). */
export function cardsLayoutElements(): TemplateBox[] {
  return [
    box('brand', 3, 3, 26, 8),
    box('clock', 78, 3.5, 19, 6, { textAlign: 'right', fontSize: 28 }),
    box('level', 3, 11, 30, 5, { fontSize: 20 }),
    box('roomName', 3, 16, 55, 10, { fontSize: 64, fontWeight: 700 }),
    box('orgName', 5, 32, 42, 8, { fontSize: 42, fontWeight: 700 }),
    box('timeRange', 5, 42, 42, 5, { fontSize: 24 }),
    box('eventTitle', 5, 48, 42, 5, { fontSize: 22 }),
    box('orgLogo', 5, 56, 14, 22),
    box('nextUp', 5, 80, 42, 6, { fontSize: 22 }),
    box('scheduleList', 52, 28, 45, 54, { fontSize: 22 }),
    box('footer', 3, 90, 94, 6, { fontSize: 20 }),
  ];
}

export function layoutFromElements(elements: TemplateBox[]): TemplateLayout {
  return { elements, updatedAt: new Date().toISOString() };
}

export const SAMPLE_PREVIEW_DATA = {
  roomName: 'Symphony 1',
  level: 'LEVEL 2',
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
};
