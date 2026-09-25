import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  cardsLayoutElements,
  classicLayoutElements,
  layoutFromElements,
} from './cardTemplateDefaults';
import type {
  CardTemplate,
  CardThemeId,
  TemplateLayout,
} from '../types/templates';

export const TEMPLATES_COL = 'templates';
export const TEMPLATE_SETTINGS_DOC = 'displayTemplates';

export type TemplateSettings = {
  defaultTemplateId: string | null;
  updatedAt?: string;
};

export function newTemplateId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createTemplateSeed(
  name: string,
  themeId: CardThemeId,
  variant: 'classic' | 'cards' = 'classic',
): CardTemplate {
  const now = new Date().toISOString();
  const elements =
    variant === 'cards' ? cardsLayoutElements() : classicLayoutElements();
  const layout = layoutFromElements(elements);
  return {
    id: newTemplateId(),
    name,
    themeId,
    draft: layout,
    published: null,
    previousPublished: null,
    isGlobalDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensureSeedTemplates(db: Firestore): Promise<void> {
  const snap = await getDocs(collection(db, TEMPLATES_COL));
  if (!snap.empty) return;

  const classic = createTemplateSeed('Classic Oyster', 'classic', 'classic');
  classic.isGlobalDefault = true;
  const cards = createTemplateSeed('Cards Panel', 'cards', 'cards');
  cards.themeId = 'cards';

  const charcoal = createTemplateSeed('Charcoal Night', 'charcoal', 'classic');
  charcoal.themeId = 'charcoal';

  const bold = createTemplateSeed('Oyster Bold', 'oyster-bold', 'classic');
  bold.themeId = 'oyster-bold';

  const steel = createTemplateSeed('Steel Gray', 'steel', 'cards');
  steel.themeId = 'steel';

  // Publish classic as default so tablets have something immediately
  classic.published = { ...classic.draft };
  classic.previousPublished = null;

  for (const t of [classic, cards, charcoal, bold, steel]) {
    await setDoc(doc(db, TEMPLATES_COL, t.id), t);
  }
  await setDoc(
    doc(db, 'settings', TEMPLATE_SETTINGS_DOC),
    {
      defaultTemplateId: classic.id,
      updatedAt: new Date().toISOString(),
    } satisfies TemplateSettings,
    { merge: true },
  );
}

export async function saveTemplateDraft(
  db: Firestore,
  template: CardTemplate,
): Promise<void> {
  const next: CardTemplate = {
    ...template,
    draft: {
      ...template.draft,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, TEMPLATES_COL, template.id), next, { merge: true });
}

export async function publishTemplate(
  db: Firestore,
  template: CardTemplate,
): Promise<CardTemplate> {
  const now = new Date().toISOString();
  const next: CardTemplate = {
    ...template,
    previousPublished: template.published,
    published: {
      elements: template.draft.elements.map((e) => ({ ...e })),
      updatedAt: now,
    },
    updatedAt: now,
  };
  await setDoc(doc(db, TEMPLATES_COL, template.id), next, { merge: true });
  return next;
}

export async function restorePreviousPublished(
  db: Firestore,
  template: CardTemplate,
): Promise<CardTemplate | null> {
  if (!template.previousPublished) return null;
  const now = new Date().toISOString();
  const next: CardTemplate = {
    ...template,
    previousPublished: template.published,
    published: {
      elements: template.previousPublished.elements.map((e) => ({ ...e })),
      updatedAt: now,
    },
    draft: {
      elements: template.previousPublished.elements.map((e) => ({ ...e })),
      updatedAt: now,
    },
    updatedAt: now,
  };
  await setDoc(doc(db, TEMPLATES_COL, template.id), next, { merge: true });
  return next;
}

export async function setGlobalDefaultTemplate(
  db: Firestore,
  templateId: string,
): Promise<void> {
  const snap = await getDocs(collection(db, TEMPLATES_COL));
  for (const d of snap.docs) {
    const isDefault = d.id === templateId;
    await setDoc(
      doc(db, TEMPLATES_COL, d.id),
      { isGlobalDefault: isDefault, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
  await setDoc(
    doc(db, 'settings', TEMPLATE_SETTINGS_DOC),
    {
      defaultTemplateId: templateId,
      updatedAt: new Date().toISOString(),
    } satisfies TemplateSettings,
    { merge: true },
  );
}

export function subscribeTemplates(
  db: Firestore,
  cb: (templates: CardTemplate[]) => void,
): Unsubscribe {
  return onSnapshot(collection(db, TEMPLATES_COL), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CardTemplate);
    list.sort((a, b) => a.name.localeCompare(b.name));
    cb(list);
  });
}

export function subscribeTemplateSettings(
  db: Firestore,
  cb: (settings: TemplateSettings) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'settings', TEMPLATE_SETTINGS_DOC), (snap) => {
    if (!snap.exists()) {
      cb({ defaultTemplateId: null });
      return;
    }
    cb(snap.data() as TemplateSettings);
  });
}

/**
 * Resolve which published layout a screen should use.
 * Order: event template → room template → global default → first published → null.
 * If a requested id exists but is unpublished, skip it (drafts never reach tablets).
 */
export function resolvePublishedLayout(
  templates: CardTemplate[],
  settings: TemplateSettings | null,
  opts: {
    eventTemplateId?: string | null;
    roomTemplateId?: string | null;
  },
): { template: CardTemplate; layout: TemplateLayout } | null {
  const byId = new Map(templates.map((t) => [t.id, t]));

  const tryId = (id: string | null | undefined) => {
    if (!id) return null;
    const t = byId.get(id);
    if (t?.published?.elements?.length) {
      return { template: t, layout: t.published };
    }
    return null;
  };

  return (
    tryId(opts.eventTemplateId) ??
    tryId(opts.roomTemplateId) ??
    tryId(settings?.defaultTemplateId) ??
    (() => {
      const def = templates.find((t) => t.isGlobalDefault && t.published);
      if (def?.published) return { template: def, layout: def.published };
      const any = templates.find((t) => t.published?.elements?.length);
      return any?.published
        ? { template: any, layout: any.published }
        : null;
    })()
  );
}

/** True when the room/event points at a template that has no published layout yet. */
export function isUnpublishedAssignment(
  templates: CardTemplate[],
  templateId: string | null | undefined,
): boolean {
  if (!templateId) return false;
  const t = templates.find((x) => x.id === templateId);
  return Boolean(t && !t.published?.elements?.length);
}

export async function getTemplate(
  db: Firestore,
  id: string,
): Promise<CardTemplate | null> {
  const snap = await getDoc(doc(db, TEMPLATES_COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CardTemplate;
}

/** Snap a % value to grid (default 1%). */
export function snapPercent(value: number, grid = 1): number {
  const g = grid > 0 ? grid : 1;
  return Math.round(value / g) * g;
}

export function clampBox(box: {
  x: number;
  y: number;
  w: number;
  h: number;
}): { x: number; y: number; w: number; h: number } {
  const w = Math.max(4, Math.min(100, box.w));
  const h = Math.max(3, Math.min(100, box.h));
  const x = Math.max(0, Math.min(100 - w, box.x));
  const y = Math.max(0, Math.min(100 - h, box.y));
  return { x, y, w, h };
}
