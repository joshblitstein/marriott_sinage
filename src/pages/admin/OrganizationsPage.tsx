import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { OrgLogo } from '../../components/OrgLogo';
import { useAuth } from '../../contexts/AuthContext';
import { writeAuditLog } from '../../lib/audit';
import { db, storage } from '../../lib/firebase';
import { isAdmin } from '../../lib/roles';
import { rebuildRoomDisplaysForDate } from '../../lib/schedule';
import { dateKeyInHotelTz } from '../../lib/time';
import type { Organization } from '../../types';

export function OrganizationsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'organizations'), orderBy('displayName')),
      (snap) => {
        setOrgs(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Organization),
        );
      },
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orgs;
    return orgs.filter(
      (o) =>
        o.displayName.toLowerCase().includes(needle) ||
        o.name.toLowerCase().includes(needle) ||
        o.aliases.some((a) => a.toLowerCase().includes(needle)),
    );
  }, [orgs, q]);

  async function saveDisplayName(org: Organization, displayName: string) {
    await updateDoc(doc(db, 'organizations', org.id), { displayName });
    await rebuildRoomDisplaysForDate(db, dateKeyInHotelTz());
    if (user) {
      await writeAuditLog(db, {
        actor: user,
        action: 'org.rename',
        entityType: 'organization',
        entityId: org.id,
        summary: `Renamed organization “${org.name}” to “${displayName}”`,
        detail: {
          orgName: org.name,
          fromName: org.displayName,
          toName: displayName,
        },
      });
    }
  }

  async function uploadLogo(org: Organization, file: File) {
    setBusyId(org.id);
    setUploadError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `logos/${org.id}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      const contentType =
        file.type && file.type.startsWith('image/')
          ? file.type
          : guessImageType(file.name);
      await uploadBytes(storageRef, file, { contentType });
      const logoUrl = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'organizations', org.id), { logoUrl });
      await rebuildRoomDisplaysForDate(db, dateKeyInHotelTz());
      if (user) {
        await writeAuditLog(db, {
          actor: user,
          action: 'org.logo.upload',
          entityType: 'organization',
          entityId: org.id,
          summary: `Uploaded logo for ${org.displayName || org.name}`,
          detail: {
            orgName: org.displayName || org.name,
            fileName: file.name,
          },
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Logo upload failed';
      setUploadError(
        message.includes('unauthorized') || message.includes('permission')
          ? 'Storage permission denied. Publish the Storage rules from storage.rules in Firebase Console → Storage → Rules.'
          : message,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function clearLogo(org: Organization) {
    await updateDoc(doc(db, 'organizations', org.id), { logoUrl: null });
    await rebuildRoomDisplaysForDate(db, dateKeyInHotelTz());
    if (user) {
      await writeAuditLog(db, {
        actor: user,
        action: 'org.logo.remove',
        entityType: 'organization',
        entityId: org.id,
        summary: `Removed logo for ${org.displayName || org.name}`,
        detail: {
          orgName: org.displayName || org.name,
        },
      });
    }
  }

  return (
    <section>
      <h1>Organizations</h1>
      <p>
        {admin
          ? 'Logos attach to the organization and appear on every room automatically.'
          : 'Upload or replace organization logos. Logos appear on every room display automatically.'}
      </p>
      {uploadError && <p className="banner error">{uploadError}</p>}
      <div className="admin-toolbar">
        <input
          placeholder="Search organizations"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Organization</th>
            {admin && <th>Display name</th>}
            <th>Logo</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((org) => (
            <tr key={org.id}>
              <td>
                <div className="org-row">
                  <OrgLogo
                    name={org.displayName}
                    logoUrl={org.logoUrl}
                    size={48}
                  />
                  <div>
                    <strong>{org.name}</strong>
                    <div className="meta">{org.displayName}</div>
                  </div>
                </div>
              </td>
              {admin && (
                <td>
                  <input
                    defaultValue={org.displayName}
                    onBlur={(e) => {
                      if (e.target.value !== org.displayName) {
                        void saveDisplayName(org, e.target.value);
                      }
                    }}
                  />
                </td>
              )}
              <td>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  disabled={busyId === org.id}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadLogo(org, file);
                  }}
                />
                {org.logoUrl && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void clearLogo(org)}
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function guessImageType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}

