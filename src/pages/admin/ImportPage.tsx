import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { importCityRows } from '../../lib/city/import';
import { readCityUpload } from '../../lib/city/readUpload';
import type { ImportSummary } from '../../types';

type ImportKind = 'day' | 'month';

export function ImportPage() {
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastKind, setLastKind] = useState<ImportKind | null>(null);

  const runImport = useCallback(async (file: File, kind: ImportKind) => {
    setBusy(true);
    setError(null);
    setSummary(null);
    setLastKind(kind);
    try {
      const rows = await readCityUpload(file);
      const result = await importCityRows(db, rows, {
        rebuildDisplays: kind === 'month' ? 'today' : 'all',
      });
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section className="hub-import">
      <h1>CITY import</h1>
      <p className="hub-import__lede">
        Upload CITY Readerboard exports (<code>.xlsx</code> or <code>.csv</code>
        ). Imports are idempotent — re-running updates in place.
      </p>

      <div className="hub-import__grid">
        <ImportDropzone
          title="Day import"
          description="Single-day readerboard file. Rebuilds room displays for every date in the file."
          busy={busy}
          onFile={(file) => void runImport(file, 'day')}
        />
        <ImportDropzone
          title="Month import"
          description="Multi-day / month export (UTF-16 tab CSV OK). Writes all days into the schedule calendar; refreshes today’s displays only."
          busy={busy}
          onFile={(file) => void runImport(file, 'month')}
        />
      </div>

      {busy && <p className="hub-import__busy">Importing… this can take a minute for a full month.</p>}
      {error && <p className="banner error">{error}</p>}

      {summary && (
        <div className="banner success">
          <h2 style={{ marginTop: 0 }}>
            {lastKind === 'month' ? 'Month' : 'Day'} import summary
          </h2>
          <p>
            Event docs written: <strong>{summary.imported}</strong>
            {summary.deleted > 0 && (
              <>
                {' '}
                · CITY rows removed: <strong>{summary.deleted}</strong>
              </>
            )}
          </p>
          <p>
            Open <Link to="/admin">Schedule</Link> and switch to{' '}
            <strong>Month</strong> to browse the imported dates.
          </p>
          <h3>Skipped</h3>
          <ul>
            {summary.skipped.length === 0 && <li>None</li>}
            {summary.skipped.map((s) => (
              <li key={s.reason}>
                {s.reason}: {s.count}
              </li>
            ))}
          </ul>
          <h3>Unmatched booking spaces</h3>
          <ul>
            {summary.unmatchedSpaces.length === 0 && <li>None</li>}
            {summary.unmatchedSpaces.map((name) => (
              <li key={name}>
                {name} — map in <Link to="/admin/rooms">Rooms</Link>
              </li>
            ))}
          </ul>
          <h3>Organizations without logos</h3>
          <ul>
            {summary.orgsWithoutLogo.length === 0 && <li>None</li>}
            {summary.orgsWithoutLogo.map((o) => (
              <li key={o.id}>
                <Link to="/admin/organizations">{o.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ImportDropzone({
  title,
  description,
  busy,
  onFile,
}: {
  title: string;
  description: string;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <div
      className="dropzone hub-import__drop"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <h2>{title}</h2>
      <p>{description}</p>
      <input
        type="file"
        accept=".xlsx,.xls,.csv,.tsv,.txt"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
