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
  idleLayoutElements,
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
  /** Used when the room has an active/upcoming event today. */
  defaultTemplateId: string | null;
  /** Used when the room has no events today (idle sign). */
  idleTemplateId: string | null;
  updatedAt?: string;
};

export type ResolvedTemplate = {
  template: CardTemplate;
  layout: TemplateLayout;
};

export function newTemplateId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createTemplateSeed(
  name: string,
  themeId: CardThemeId,
  variant: 'classic' | 'cards' | 'idle' = 'classic',
): CardTemplate {
  const now = new Date().toISOString();
  const elements =
    variant === 'idle'
      ? idleLayoutElements()
      : variant === 'cards'
        ? cardsLayoutElements()
        : classicLayoutElements();
  const layout = layoutFromElements(elements);
  return {
    id: newTemplateId(),
    name,
    themeId,
    draft: layout,
    published: null,
    previousPublished: null,
    isGlobalDefault: false,
    isIdleDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensureSeedTemplates(db: Firestore): Promise<void> {
  const snap = await getDocs(collection(db, TEMPLATES_COL));
  if (!snap.empty) {
    await ensureIdleAndEventDefaults(db);
    return;
  }

  const idle = createTemplateSeed('Empty room', 'classic', 'idle');
  idle.isIdleDefault = true;
  idle.published = { ...idle.draft };

  const classic = createTemplateSeed('Classic Oyster', 'classic', 'classic');
  classic.isGlobalDefault = true;
  classic.published = { ...classic.draft };

  const cards = createTemplateSeed('Cards Panel', 'cards', 'cards');
  cards.themeId = 'cards';
  cards.published = { ...cards.draft };

  const charcoal = createTemplateSeed('Charcoal Night', 'charcoal', 'classic');
  charcoal.themeId = 'charcoal';
  charcoal.published = { ...charcoal.draft };

  const bold = createTemplateSeed('Oyster Bold', 'oyster-bold', 'classic');
  bold.themeId = 'oyster-bold';
  bold.published = { ...bold.draft };

  const steel = createTemplateSeed('Steel Gray', 'steel', 'cards');
  steel.themeId = 'steel';
  steel.published = { ...steel.draft };

  for (const t of [idle, classic, cards, charcoal, bold, steel]) {
    await setDoc(doc(db, TEMPLATES_COL, t.id), t);
  }
  await setDoc(
    doc(db, 'settings', TEMPLATE_SETTINGS_DOC),
    {
      idleTemplateId: idle.id,
      defaultTemplateId: classic.id,
      updatedAt: new Date().toISOString(),
    } satisfies TemplateSettings,
    { merge: true },
  );
}

/** For existing installs: ensure idle + event defaults exist and are linked. */
export async function ensureIdleAndEventDefaults(db: Firestore): Promise<void> {
  const [tplSnap, settingsSnap] = await Promise.all([
    getDocs(collection(db, TEMPLATES_COL)),
    getDoc(doc(db, 'settings', TEMPLATE_SETTINGS_DOC)),
  ]);
  const templates = tplSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as CardTemplate,
  );
  const settings = (settingsSnap.data() as TemplateSettings | undefined) ?? {
    defaultTemplateId: null,
    idleTemplateId: null,
  };

  let idleId = settings.idleTemplateId;
  let eventId = settings.defaultTemplateId;

  const idleOk = idleId
    ? templates.some((t) => t.id === idleId && t.published?.elements?.length)
    : false;

  if (!idleOk) {
    const named = templates.find(
      (t) =>
        t.isIdleDefault ||
        t.name.toLowerCase().includes('empty') ||
        t.name.toLowerCase().includes('idle'),
    );
    if (named?.published?.elements?.length) {
      idleId = named.id;
    } else if (named) {
      // Publish existing idle-ish draft
      await setDoc(
        doc(db, TEMPLATES_COL, named.id),
        {
          published: named.draft,
          isIdleDefault: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      idleId = named.id;
    } else {
      const idle = createTemplateSeed('Empty room', 'classic', 'idle');
      idle.isIdleDefault = true;
      idle.published = { ...idle.draft };
      await setDoc(doc(db, TEMPLATES_COL, idle.id), idle);
      idleId = idle.id;
    }
  }

  const eventOk = eventId
    ? templates.some((t) => t.id === eventId && t.published?.elements?.length)
    : false;
  if (!eventOk) {
    const eventTpl =
      templates.find((t) => t.isGlobalDefault && t.published) ??
      templates.find(
        (t) => t.published && t.id !== idleId && t.name !== 'Empty room',
      ) ??
      templates.find((t) => t.published);
    eventId = eventTpl?.id ?? null;
  }

  await setDoc(
    doc(db, 'settings', TEMPLATE_SETTINGS_DOC),
    {
      idleTemplateId: idleId ?? null,
      defaultTemplateId: eventId ?? null,
      updatedAt: new Date().toISOString(),
    } satisfies TemplateSettings,
    { merge: true },
  );

  // Keep flags in sync
  for (const t of templates) {
    const nextIdle = t.id === idleId;
    const nextEvent = t.id === eventId;
    if (Boolean(t.isIdleDefault) !== nextIdle || Boolean(t.isGlobalDefault) !== nextEvent) {
      await setDoc(
        doc(db, TEMPLATES_COL, t.id),
        {
          isIdleDefault: nextIdle,
          isGlobalDefault: nextEvent,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }
  }
  // New idle may not be in `templates` snapshot list above
  if (idleId && !templates.some((t) => t.id === idleId)) {
    await setDoc(
      doc(db, TEMPLATES_COL, idleId),
      { isIdleDefault: true, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
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

/** Global default for rooms that currently have an event. */
export async function setEventDefaultTemplate(
  db: Firestore,
  templateId: string,
): Promise<void> {
  const snap = await getDocs(collection(db, TEMPLATES_COL));
  for (const d of snap.docs) {
    await setDoc(
      doc(db, TEMPLATES_COL, d.id),
      {
        isGlobalDefault: d.id === templateId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }
  await setDoc(
    doc(db, 'settings', TEMPLATE_SETTINGS_DOC),
    {
      defaultTemplateId: templateId,
      updatedAt: new Date().toISOString(),
    } satisfies Partial<TemplateSettings>,
    { merge: true },
  );
}

/** Global default for rooms with no events today. */
export async function setIdleDefaultTemplate(
  db: Firestore,
  templateId: string,
): Promise<void> {
  const snap = await getDocs(collection(db, TEMPLATES_COL));
  for (const d of snap.docs) {
    await setDoc(
      doc(db, TEMPLATES_COL, d.id),
      {
        isIdleDefault: d.id === templateId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }
  await setDoc(
    doc(db, 'settings', TEMPLATE_SETTINGS_DOC),
    {
      idleTemplateId: templateId,
      updatedAt: new Date().toISOString(),
    } satisfies Partial<TemplateSettings>,
    { merge: true },
  );
}

/** @deprecated use setEventDefaultTemplate */
export async function setGlobalDefaultTemplate(
  db: Firestore,
  templateId: string,
): Promise<void> {
  return setEventDefaultTemplate(db, templateId);
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
      cb({ defaultTemplateId: null, idleTemplateId: null });
      return;
    }
    const data = snap.data() as TemplateSettings;
    cb({
      defaultTemplateId: data.defaultTemplateId ?? null,
      idleTemplateId: data.idleTemplateId ?? null,
      updatedAt: data.updatedAt,
    });
  });
}

function tryPublished(
  byId: Map<string, CardTemplate>,
  id: string | null | undefined,
): ResolvedTemplate | null {
  if (!id) return null;
  const t = byId.get(id);
  if (t?.published?.elements?.length) {
    return { template: t, layout: t.published };
  }
  return null;
}

/** Idle / no-event sign — global idle default (room overrides not used). */
export function resolveIdleLayout(
  templates: CardTemplate[],
  settings: TemplateSettings | null,
): ResolvedTemplate | null {
  const byId = new Map(templates.map((t) => [t.id, t]));
  return (
    tryPublished(byId, settings?.idleTemplateId) ??
    (() => {
      const def = templates.find((t) => t.isIdleDefault && t.published);
      return def?.published ? { template: def, layout: def.published } : null;
    })()
  );
}

/**
 * Event sign — event template → room template → global event default.
 */
export function resolveEventLayout(
  templates: CardTemplate[],
  settings: TemplateSettings | null,
  opts: {
    eventTemplateId?: string | null;
    roomTemplateId?: string | null;
  },
): ResolvedTemplate | null {
  const byId = new Map(templates.map((t) => [t.id, t]));
  return (
    tryPublished(byId, opts.eventTemplateId) ??
    tryPublished(byId, opts.roomTemplateId) ??
    tryPublished(byId, settings?.defaultTemplateId) ??
    (() => {
      const def = templates.find((t) => t.isGlobalDefault && t.published);
      if (def?.published) return { template: def, layout: def.published };
      const any = templates.find(
        (t) => t.published?.elements?.length && !t.isIdleDefault,
      );
      return any?.published
        ? { template: any, layout: any.published }
        : null;
    })()
  );
}

/** @deprecated use resolveEventLayout / resolveIdleLayout */
export function resolvePublishedLayout(
  templates: CardTemplate[],
  settings: TemplateSettings | null,
  opts: {
    eventTemplateId?: string | null;
    roomTemplateId?: string | null;
  },
): ResolvedTemplate | null {
  return resolveEventLayout(templates, settings, opts);
}

export async function getTemplate(
  db: Firestore,
  id: string,
): Promise<CardTemplate | null> {
  const snap = await getDoc(doc(db, TEMPLATES_COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CardTemplate;
}

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
