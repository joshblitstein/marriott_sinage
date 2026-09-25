import { useEffect, useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { TemplateEditor } from '../../components/cardTemplate/TemplateEditor';
import { useAuth } from '../../contexts/AuthContext';
import { writeAuditLog } from '../../lib/audit';
import { SAMPLE_PREVIEW_DATA } from '../../lib/cardTemplateDefaults';
import {
  createTemplateSeed,
  ensureSeedTemplates,
  publishTemplate,
  restorePreviousPublished,
  saveTemplateDraft,
  setGlobalDefaultTemplate,
  subscribeTemplates,
} from '../../lib/cardTemplates';
import { db } from '../../lib/firebase';
import { isAdmin } from '../../lib/roles';
import type {
  CardTemplate,
  CardThemeId,
  TemplateBox,
} from '../../types/templates';

export function TemplatesPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [working, setWorking] = useState<CardTemplate | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void ensureSeedTemplates(db).catch((err) =>
      console.warn('seed templates', err),
    );
    return subscribeTemplates(db, (list) => {
      setTemplates(list);
      setActiveId((cur) => {
        const next = cur ?? list[0]?.id ?? null;
        return next;
      });
    });
  }, []);

  useEffect(() => {
    if (!activeId) {
      setWorking(null);
      return;
    }
    const t = templates.find((x) => x.id === activeId);
    if (!t) return;
    // Don't clobber in-progress edits when remote snapshot arrives
    setWorking((prev) => {
      if (prev && prev.id === t.id && dirty) return prev;
      return structuredClone(t);
    });
  }, [activeId, templates, dirty]);

  const active = working;

  function selectTemplate(id: string) {
    if (dirty && !confirm('Discard unsaved draft changes?')) return;
    setDirty(false);
    setActiveId(id);
    const t = templates.find((x) => x.id === id);
    setWorking(t ? structuredClone(t) : null);
  }

  function setElements(elements: TemplateBox[]) {
    if (!active) return;
    setWorking({
      ...active,
      draft: { elements, updatedAt: new Date().toISOString() },
    });
    setDirty(true);
  }

  function setTheme(themeId: CardThemeId) {
    if (!active) return;
    setWorking({ ...active, themeId });
    setDirty(true);
  }

  function setName(name: string) {
    if (!active) return;
    setWorking({ ...active, name });
    setDirty(true);
  }

  async function onSaveDraft() {
    if (!admin || !active) return;
    setBusy(true);
    setMessage(null);
    try {
      await saveTemplateDraft(db, active);
      setDirty(false);
      setMessage('Draft saved');
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    if (!admin || !active) return;
    setBusy(true);
    setMessage(null);
    try {
      if (dirty) await saveTemplateDraft(db, active);
      const next = await publishTemplate(db, active);
      setWorking(next);
      setDirty(false);
      if (user) {
        await writeAuditLog(db, {
          actor: user,
          action: 'event.update',
          entityType: 'system',
          entityId: next.id,
          summary: `Published room card template “${next.name}”`,
          status: 'live',
        });
      }
      setMessage('Published — tablets update within seconds');
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    if (!admin || !active?.previousPublished) return;
    if (!confirm('Restore the previously published version?')) return;
    setBusy(true);
    try {
      const next = await restorePreviousPublished(db, active);
      if (next) {
        setWorking(next);
        setDirty(false);
        setMessage('Restored previous published version');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onMakeDefault() {
    if (!admin || !active) return;
    setBusy(true);
    try {
      await setGlobalDefaultTemplate(db, active.id);
      setMessage(`“${active.name}” is now the global default`);
    } finally {
      setBusy(false);
    }
  }

  async function onCreate() {
    if (!admin) return;
    if (dirty && !confirm('Discard unsaved draft changes?')) return;
    const seed = createTemplateSeed('New template', 'classic', 'classic');
    await setDoc(doc(db, 'templates', seed.id), seed);
    setDirty(false);
    setActiveId(seed.id);
    setWorking(seed);
    setMessage('Created new template draft');
  }

  const tabList = useMemo(() => templates, [templates]);

  return (
    <section className="templates-page">
      <header className="templates-page__header">
        <div>
          <h1>Room card templates</h1>
          <p>
            Pick a theme, arrange elements on a 1920×1080 canvas, then publish.
            Tablets use event → room → global default. Only published layouts
            reach displays.
          </p>
        </div>
        <div className="templates-page__actions">
          {admin && (
            <>
              <button
                type="button"
                className="hub-btn hub-btn--soft"
                onClick={() => void onCreate()}
              >
                New template
              </button>
              <button
                type="button"
                className="hub-btn hub-btn--soft"
                disabled={!active || busy || !dirty}
                onClick={() => void onSaveDraft()}
              >
                Save draft
              </button>
              <button
                type="button"
                className="hub-btn hub-btn--soft"
                disabled={!active || busy}
                onClick={() => void onMakeDefault()}
              >
                Set as default
              </button>
              <button
                type="button"
                className="hub-btn hub-btn--soft"
                disabled={!active?.previousPublished || busy}
                onClick={() => void onRestore()}
              >
                Restore previous
              </button>
              <button
                type="button"
                className="hub-btn hub-btn--primary"
                disabled={!active || busy}
                onClick={() => void onPublish()}
              >
                {busy ? 'Working…' : 'Publish'}
              </button>
            </>
          )}
        </div>
      </header>

      {message && <p className="templates-page__toast">{message}</p>}
      {dirty && (
        <p className="templates-page__toast templates-page__toast--warn">
          Unsaved draft changes
        </p>
      )}

      <div className="templates-page__tabs">
        {tabList.map((t) => (
          <button
            key={t.id}
            type="button"
            className={
              t.id === activeId
                ? 'templates-page__tab is-active'
                : 'templates-page__tab'
            }
            onClick={() => selectTemplate(t.id)}
          >
            {t.name}
            {t.published ? (
              <span className="templates-page__pill">Live</span>
            ) : (
              <span className="templates-page__pill templates-page__pill--draft">
                Draft
              </span>
            )}
            {t.isGlobalDefault && (
              <span className="templates-page__pill templates-page__pill--default">
                Default
              </span>
            )}
          </button>
        ))}
      </div>

      {active ? (
        <>
          <div className="templates-page__name-row">
            <label>
              Template name
              <input
                value={active.name}
                disabled={!admin}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className="templates-page__meta">
              Draft {new Date(active.draft.updatedAt).toLocaleString()}
              {active.published
                ? ` · Published ${new Date(active.published.updatedAt).toLocaleString()}`
                : ' · Not published yet'}
            </p>
          </div>
          <TemplateEditor
            themeId={active.themeId}
            elements={active.draft.elements}
            onChangeTheme={setTheme}
            onChangeElements={setElements}
            previewData={SAMPLE_PREVIEW_DATA}
          />
        </>
      ) : (
        <p className="templates-page__empty">Loading templates…</p>
      )}
    </section>
  );
}
