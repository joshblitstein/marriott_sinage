import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { SAMPLE_PREVIEW_DATA } from '../../lib/cardTemplateDefaults';
import { CARD_THEME_LIST } from '../../lib/cardThemes';
import { clampBox, snapPercent } from '../../lib/cardTemplates';
import type {
  CardThemeId,
  TemplateBox,
  TemplateElementKind,
  TemplatePreviewData,
} from '../../types/templates';
import { TemplateCanvas } from './TemplateCanvas';

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const GRID = 1;

const ADDABLE: { kind: TemplateElementKind; label: string }[] = [
  { kind: 'orgLogo', label: 'Org logo' },
  { kind: 'orgName', label: 'Org name' },
  { kind: 'eventTitle', label: 'Event title' },
  { kind: 'timeRange', label: 'Time range' },
  { kind: 'roomName', label: 'Room name' },
  { kind: 'nextUp', label: 'Next up' },
  { kind: 'customText', label: 'Custom text' },
  { kind: 'image', label: 'Image' },
  { kind: 'brand', label: 'Brand' },
  { kind: 'level', label: 'Level' },
  { kind: 'clock', label: 'Clock' },
  { kind: 'scheduleList', label: 'Schedule list' },
  { kind: 'footer', label: 'Footer' },
];

type Props = {
  themeId: CardThemeId;
  elements: TemplateBox[];
  onChangeTheme: (id: CardThemeId) => void;
  onChangeElements: (els: TemplateBox[]) => void;
  previewData?: TemplatePreviewData;
};

type DragMode = 'move' | 'resize';

export function TemplateEditor({
  themeId,
  elements,
  onChangeTheme,
  onChangeElements,
  previewData = SAMPLE_PREVIEW_DATA,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    id: string;
    startX: number;
    startY: number;
    orig: TemplateBox;
  } | null>(null);

  const selected = elements.find((e) => e.id === selectedId) ?? null;

  const updateBox = useCallback(
    (id: string, patch: Partial<TemplateBox>) => {
      onChangeElements(
        elements.map((e) => {
          if (e.id !== id) return e;
          const next = { ...e, ...patch };
          const clamped = clampBox(next);
          return {
            ...next,
            x: snapPercent(clamped.x, GRID),
            y: snapPercent(clamped.y, GRID),
            w: snapPercent(clamped.w, GRID),
            h: snapPercent(clamped.h, GRID),
          };
        }),
      );
    },
    [elements, onChangeElements],
  );

  function onPointerDown(
    e: ReactPointerEvent,
    id: string,
    mode: DragMode,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const box = elements.find((x) => x.id === id);
    if (!box) return;
    setSelectedId(id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      mode,
      id,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...box },
    };
  }

  function onPointerMove(e: ReactPointerEvent) {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const rect = stage.getBoundingClientRect();
    const dx = ((e.clientX - drag.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.startY) / rect.height) * 100;

    if (drag.mode === 'move') {
      updateBox(drag.id, {
        x: drag.orig.x + dx,
        y: drag.orig.y + dy,
      });
    } else {
      updateBox(drag.id, {
        w: drag.orig.w + dx,
        h: drag.orig.h + dy,
      });
    }
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function addElement(kind: TemplateElementKind) {
    const id = `${kind}_${Date.now().toString(36)}`;
    const el: TemplateBox = {
      id,
      kind,
      x: 10,
      y: 10,
      w: kind === 'orgLogo' || kind === 'image' ? 14 : 36,
      h: kind === 'orgLogo' || kind === 'image' ? 22 : 8,
      content: kind === 'customText' ? 'Custom text' : undefined,
      fontSize: 28,
    };
    onChangeElements([...elements, el]);
    setSelectedId(id);
  }

  function removeSelected() {
    if (!selectedId) return;
    onChangeElements(elements.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  }

  return (
    <div className="tpl-editor">
      <aside className="tpl-editor__sidebar">
        <h3>Theme</h3>
        <div className="tpl-editor__themes">
          {CARD_THEME_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              className={
                themeId === t.id
                  ? 'tpl-theme-swatch is-active'
                  : 'tpl-theme-swatch'
              }
              onClick={() => onChangeTheme(t.id)}
              title={t.description}
            >
              <span
                className="tpl-theme-swatch__chip"
                style={{ background: t.background, color: t.ink }}
              >
                Aa
              </span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>

        <h3>Add element</h3>
        <div className="tpl-editor__add">
          {ADDABLE.map((a) => (
            <button
              key={a.kind}
              type="button"
              className="hub-btn hub-btn--soft"
              onClick={() => addElement(a.kind)}
            >
              {a.label}
            </button>
          ))}
        </div>

        {selected && (
          <div className="tpl-editor__props">
            <h3>Selected · {selected.kind}</h3>
            <label>
              Font size (px @1080p)
              <input
                type="number"
                min={12}
                max={120}
                value={selected.fontSize ?? 28}
                onChange={(e) =>
                  updateBox(selected.id, {
                    fontSize: Number(e.target.value) || 28,
                  })
                }
              />
            </label>
            {(selected.kind === 'customText' || selected.kind === 'image') && (
              <label>
                {selected.kind === 'image' ? 'Image URL' : 'Text'}
                <input
                  value={
                    selected.kind === 'image'
                      ? selected.imageUrl ?? ''
                      : selected.content ?? ''
                  }
                  onChange={(e) =>
                    updateBox(
                      selected.id,
                      selected.kind === 'image'
                        ? { imageUrl: e.target.value }
                        : { content: e.target.value },
                    )
                  }
                />
              </label>
            )}
            <p className="tpl-editor__hint">
              {Math.round(selected.x)}%, {Math.round(selected.y)}% ·{' '}
              {Math.round(selected.w)}×{Math.round(selected.h)}%
            </p>
            <button
              type="button"
              className="hub-btn hub-btn--danger"
              onClick={removeSelected}
            >
              Remove element
            </button>
          </div>
        )}
      </aside>

      <div className="tpl-editor__stage-wrap">
        <p className="tpl-editor__ratio">
          Editor canvas {CANVAS_W}×{CANVAS_H} (tablet landscape) · {GRID}% snap
          grid
        </p>
        <div
          ref={stageRef}
          className="tpl-editor__stage"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={() => setSelectedId(null)}
        >
          <div className="tpl-editor__canvas-frame">
            <TemplateCanvas
              themeId={themeId}
              elements={elements}
              data={previewData}
              showGuides
              selectedId={selectedId}
            />
            {elements
              .filter((e) => !e.hidden)
              .map((el) => (
                <div
                  key={`h-${el.id}`}
                  className={`tpl-handle${selectedId === el.id ? ' is-selected' : ''}`}
                  style={{
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    width: `${el.w}%`,
                    height: `${el.h}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(el.id);
                  }}
                  onPointerDown={(e) => onPointerDown(e, el.id, 'move')}
                >
                  <span className="tpl-handle__label">{el.kind}</span>
                  <button
                    type="button"
                    className="tpl-handle__resize"
                    aria-label="Resize"
                    onPointerDown={(e) => onPointerDown(e, el.id, 'resize')}
                  />
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
