import { useEffect, useRef, type CSSProperties } from 'react';
import { OrgLogo } from '../OrgLogo';
import { themeById } from '../../lib/cardThemes';
import type {
  CardThemeId,
  TemplateBox,
  TemplatePreviewData,
} from '../../types/templates';

type Props = {
  themeId: CardThemeId;
  elements: TemplateBox[];
  data: TemplatePreviewData;
  /** When true, show empty frames for editor chrome */
  showGuides?: boolean;
  selectedId?: string | null;
  className?: string;
};

/** Renders a template layout at whatever CSS size the parent provides (percent boxes). */
export function TemplateCanvas({
  themeId,
  elements,
  data,
  showGuides,
  selectedId,
  className,
}: Props) {
  const theme = themeById(themeId);
  const sorted = [...elements]
    .filter((e) => !e.hidden)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return (
    <div
      className={`tpl-canvas${className ? ` ${className}` : ''}`}
      style={
        {
          '--tpl-bg': theme.background,
          '--tpl-surface': theme.surface,
          '--tpl-ink': theme.ink,
          '--tpl-muted': theme.muted,
          '--tpl-accent': theme.accent,
          '--tpl-line': theme.line,
          '--tpl-font-display': theme.fontDisplay,
          '--tpl-font-body': theme.fontBody,
          background: theme.background,
          color: theme.ink,
        } as CSSProperties
      }
    >
      {sorted.map((el) => (
        <div
          key={el.id}
          className={`tpl-el tpl-el--${el.kind}${selectedId === el.id ? ' is-selected' : ''}${showGuides ? ' is-guide' : ''}`}
          data-el-id={el.id}
          style={{
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.w}%`,
            height: `${el.h}%`,
            zIndex: el.zIndex ?? 1,
            textAlign: el.textAlign ?? 'left',
            // Authored for 1080p; scale with container height (cqh)
            fontSize: el.fontSize
              ? `calc(${el.fontSize} * 100cqh / 1080)`
              : undefined,
            fontWeight: el.fontWeight,
          }}
        >
          <ElementContent el={el} data={data} logoSrc={theme.logoSrc} />
        </div>
      ))}
    </div>
  );
}

function ElementContent({
  el,
  data,
  logoSrc,
}: {
  el: TemplateBox;
  data: TemplatePreviewData;
  logoSrc: string;
}) {
  switch (el.kind) {
    case 'brand':
      return (
        <img className="tpl-brand" src={logoSrc} alt="Sheraton" draggable={false} />
      );
    case 'level':
      return <span className="tpl-label">{data.level}</span>;
    case 'clock':
      return <span className="tpl-clock">{data.nowClock}</span>;
    case 'roomName':
      return <AutoFitText className="tpl-room" text={data.roomName} />;
    case 'orgLogo':
      return (
        <div className="tpl-logo">
          <OrgLogo name={data.orgDisplayName} logoUrl={data.logoUrl} />
        </div>
      );
    case 'orgName':
      return <AutoFitText className="tpl-org" text={data.orgDisplayName} />;
    case 'eventTitle':
      return <AutoFitText className="tpl-title" text={data.eventTitle} />;
    case 'timeRange':
      return <span className="tpl-time">{data.timeRange}</span>;
    case 'nextUp':
      return <span className="tpl-next">{data.nextUp}</span>;
    case 'scheduleList':
      return (
        <ul className="tpl-schedule">
          <li className="tpl-schedule__head">Today in this room</li>
          {data.scheduleLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      );
    case 'footer':
      return (
        <div className="tpl-footer">
          <span>{data.footerLeft}</span>
          <span>{data.footerRight}</span>
        </div>
      );
    case 'customText':
      return (
        <AutoFitText
          className="tpl-custom"
          text={el.content?.trim() || 'Custom text'}
        />
      );
    case 'image':
      return el.imageUrl ? (
        <img className="tpl-image" src={el.imageUrl} alt="" draggable={false} />
      ) : (
        <div className="tpl-image tpl-image--empty">Image</div>
      );
    default:
      return null;
  }
}

/** Shrink font until text fits the box width (long org names). */
function AutoFitText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const max = parent.clientWidth;
      const maxH = parent.clientHeight;
      if (max < 8 || maxH < 8) return;

      let size = parseFloat(getComputedStyle(parent).fontSize) || 32;
      el.style.fontSize = `${size}px`;
      el.style.whiteSpace = 'nowrap';

      let guard = 40;
      while (
        guard-- > 0 &&
        size > 10 &&
        (el.scrollWidth > max || el.scrollHeight > maxH)
      ) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }

      if (el.scrollWidth > max) {
        el.style.whiteSpace = 'normal';
        el.style.overflow = 'hidden';
        el.style.display = '-webkit-box';
        (el.style as CSSStyleDeclaration & { webkitLineClamp: string }).webkitLineClamp =
          '2';
        el.style.setProperty('-webkit-box-orient', 'vertical');
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div ref={ref} className={className}>
      {text}
    </div>
  );
}
