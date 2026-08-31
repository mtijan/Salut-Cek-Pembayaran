import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileClock, RefreshCw } from 'lucide-react';
import { auditApi } from '../services/auditApi.js';
import { isAbortError } from '../services/http.js';

const PAGE_SIZE = 50;

function metadataSummary(metadata) {
  const entries = Object.entries(metadata || {});
  if (!entries.length) return '-';
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ');
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestRef = useRef(null);

  const loadLogs = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const result = await auditApi.list(
        { action, entity_type: entityType, limit: PAGE_SIZE, offset: 0 },
        { signal: controller.signal },
      );
      if (requestRef.current === controller) {
        setLogs(result.audit_logs || []);
        setPagination(result.pagination || { total: 0, limit: PAGE_SIZE, offset: 0 });
      }
    } catch (requestError) {
      if (!isAbortError(requestError) && requestRef.current === controller) {
        setError(requestError.message || 'Gagal memuat audit log.');
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [action, entityType]);

  useEffect(() => {
    loadLogs();
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [loadLogs]);

  return (
    <section className="users-page" aria-labelledby="audit-page-title">
      <div className="users-header-row">
        <div>
          <h1 id="audit-page-title" className="users-header-title">
            <FileClock size={24} color="#6366f1" /> Audit Log Sistem
          </h1>
          <p className="users-header-desc">
            Riwayat administratif bersifat read-only; metadata pribadi dan kredensial direduksi oleh
            server.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-icon-gap"
          onClick={loadLogs}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Segarkan
        </button>
      </div>

      <div className="card users-filter-card">
        <div className="users-filter-row">
          <label className="form-group form-group-no-mb">
            <span>Aksi</span>
            <input
              className="form-control"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="Contoh: user.update"
            />
          </label>
          <label className="form-group form-group-no-mb">
            <span>Jenis Entitas</span>
            <input
              className="form-control"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              placeholder="Contoh: admin_user"
            />
          </label>
        </div>
      </div>

      {error && (
        <div role="alert" className="modal-alert-danger">
          {error}
        </div>
      )}

      <div className="card users-table-card">
        <div className="table-responsive">
          <table className="data-table">
            <caption className="sr-only">Daftar audit administratif yang sudah direduksi</caption>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pelaku</th>
                <th>Aksi</th>
                <th>Entitas</th>
                <th>Metadata Aman</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cell-centered-padded">
                    Memuat audit log...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cell-centered-padded">
                    Tidak ada audit log yang sesuai.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="cell-subtext">{log.created_at}</td>
                    <td>{log.actor_name || 'System'}</td>
                    <td className="cell-bold-title">{log.action}</td>
                    <td>{log.entity_type}</td>
                    <td className="cell-subtext">{metadataSummary(log.metadata)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="pagination-text" aria-live="polite">
          Menampilkan {logs.length} dari {pagination.total} audit log
        </p>
      </div>
    </section>
  );
}

AuditLogsPage.displayName = 'AuditLogsPage';
