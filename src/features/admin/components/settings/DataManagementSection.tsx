import React, { useState, useRef } from 'react';
import { uiText } from '../../../../ui-text';
import type { DataExportEnvelope, PreflightSummary } from '../../../../../shared/domain/data-management';

export function DataManagementSection() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePayload, setFilePayload] = useState<DataExportEnvelope | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightSummary, setPreflightSummary] = useState<PreflightSummary | null>(null);
  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = uiText.admin.settings.dataManagement;

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      const res = await fetch('/api/admin/data/export');
      if (!res.ok) {
        throw new Error(t.exportError(res.status));
      }

      const disposition = res.headers.get('Content-Disposition') || '';
      let filename = 'bewerbsboard-export.json';
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportSuccess(t.exportSuccess);
    } catch (err: any) {
      setExportError(err.message || 'Export fehlgeschlagen.');
    } finally {
      setExporting(false);
    }
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setFilePayload(null);
    setPreflightSummary(null);
    setPreflightErrors([]);
    setImportError(null);
    setImportSuccess(null);
    setPreflightLoading(true);

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Die ausgewählte Datei ist kein gültiges JSON.');
      }

      const res = await fetch('/api/admin/data/import/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.isValid) {
        setPreflightErrors(data.errors || [data.error || 'Validierungsfehler.']);
      } else {
        setFilePayload(parsed as DataExportEnvelope);
        setPreflightSummary(data as PreflightSummary);
      }
    } catch (err: any) {
      setPreflightErrors([err.message || 'Fehler beim Lesen der Datei.']);
    } finally {
      setPreflightLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      processFile(file);
    } else if (file) {
      setPreflightErrors(['Bitte nur .json Dateien auswählen.']);
    }
  };

  const handleExecuteImport = async () => {
    if (!filePayload) return;
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const res = await fetch('/api/admin/data/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filePayload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Import fehlgeschlagen.');
      }

      setImportSuccess(t.importSuccess);
      // Reset staging
      setSelectedFile(null);
      setFilePayload(null);
      setPreflightSummary(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setImportError(t.importError(err.message || 'Unbekannter Fehler'));
    } finally {
      setImporting(false);
    }
  };

  const handleResetImport = () => {
    setSelectedFile(null);
    setFilePayload(null);
    setPreflightSummary(null);
    setPreflightErrors([]);
    setImportError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Description */}
      <div>
        <h3 className="text-xl font-bold text-white tracking-wide font-oswald flex items-center gap-2">
          <span>💾</span>
          <span>{t.title}</span>
        </h3>
        <p className="text-sm text-neutral-400 mt-1 max-w-3xl">
          {t.description}
        </p>
      </div>

      {/* 1. EXPORT SECTION */}
      <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h4 className="text-base font-bold text-neutral-100 flex items-center gap-2">
            <span>📥</span>
            <span>{t.exportTitle}</span>
          </h4>
          <p className="text-xs text-neutral-400 mt-1">
            {t.exportDescription}
          </p>
        </div>

        {exportError && (
          <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 rounded-xl text-xs flex items-center justify-between">
            <span>⚠️ {exportError}</span>
            <button type="button" onClick={() => setExportError(null)} className="text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {exportSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 px-4 py-3 rounded-xl text-xs flex items-center justify-between">
            <span>✓ {exportSuccess}</span>
            <button type="button" onClick={() => setExportSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-white font-semibold rounded-xl text-sm transition-colors border border-neutral-700 shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t.exporting}</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>{t.exportButton}</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* 2. IMPORT SECTION */}
      <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h4 className="text-base font-bold text-neutral-100 flex items-center gap-2">
            <span>📤</span>
            <span>{t.importTitle}</span>
          </h4>
          <p className="text-xs text-neutral-400 mt-1">
            {t.importDescription}
          </p>
        </div>

        {importSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 px-4 py-3.5 rounded-xl text-sm flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2 font-semibold">
              <span>🎉</span>
              <span>{importSuccess}</span>
            </div>
            <button type="button" onClick={() => setImportSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {importError && (
          <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3.5 rounded-xl text-sm flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{importError}</span>
            </div>
            <button type="button" onClick={() => setImportError(null)} className="text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {/* File dropzone / selector */}
        {!preflightSummary && (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-neutral-700 hover:border-red-500/60 rounded-xl p-8 text-center transition-colors bg-neutral-950/50 flex flex-col items-center justify-center space-y-3 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="text-3xl">📄</div>
            <div className="text-sm font-semibold text-neutral-200">
              {preflightLoading ? t.analyzingFile : t.selectFile}
            </div>
            <div className="text-xs text-neutral-500">
              {t.dragDropHint} (.json)
            </div>
          </div>
        )}

        {/* Preflight Errors Box */}
        {preflightErrors.length > 0 && (
          <div className="bg-red-950/80 border border-red-800 text-red-200 p-4 rounded-xl space-y-2">
            <div className="text-sm font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{t.preflightInvalid}</span>
            </div>
            <ul className="text-xs space-y-1 pl-5 list-disc text-red-300">
              {preflightErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetImport}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs rounded-lg font-medium transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Preflight Success & Summary Table */}
        {preflightSummary && preflightSummary.isValid && (
          <div className="space-y-4 bg-neutral-950/60 border border-neutral-800 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div>
                <h5 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <span>✓</span>
                  <span>{t.preflightValid}</span>
                </h5>
                <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                  {selectedFile?.name} ({t.totalEntities(preflightSummary.totalEntities)})
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetImport}
                className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                {t.cancel}
              </button>
            </div>

            {/* Table Breakdown */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-900 text-neutral-400">
                  <tr>
                    <th className="px-3.5 py-2.5 rounded-l-lg">{t.tableHeaderEntity}</th>
                    <th className="px-3.5 py-2.5 text-center">{t.tableHeaderTotal}</th>
                    <th className="px-3.5 py-2.5 text-center text-emerald-400">{t.tableHeaderNew}</th>
                    <th className="px-3.5 py-2.5 text-center text-amber-400 rounded-r-lg">{t.tableHeaderUpdate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {[
                    { label: t.entityAppConfig, count: preflightSummary.summary.appConfig },
                    { label: t.entityCompetitionClasses, count: preflightSummary.summary.competitionClasses },
                    { label: t.entityFireBrigades, count: preflightSummary.summary.fireBrigades },
                    { label: t.entityCategoryTypes, count: preflightSummary.summary.categoryTypes },
                    { label: t.entityEvaluationTypes, count: preflightSummary.summary.evaluationTypes },
                    { label: t.entityGroups, count: preflightSummary.summary.groups },
                    { label: t.entityCategoryEntries, count: preflightSummary.summary.categoryEntries },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-neutral-900/40">
                      <td className="px-3.5 py-2 font-medium text-neutral-300">{row.label}</td>
                      <td className="px-3.5 py-2 text-center font-mono text-neutral-400">{row.count.total}</td>
                      <td className="px-3.5 py-2 text-center font-mono text-emerald-400 font-semibold">{row.count.toInsert}</td>
                      <td className="px-3.5 py-2 text-center font-mono text-amber-400 font-semibold">{row.count.toUpdate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-neutral-900/80 border border-neutral-800 rounded-lg text-xs text-neutral-400 flex items-start gap-2">
              <span className="text-amber-400 text-sm">ℹ️</span>
              <span>{t.warningNote}</span>
            </div>

            {/* Confirmation & Import Trigger */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={importing}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl text-sm transition-colors shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t.importing}</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>{t.importButton}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleResetImport}
                disabled={importing}
                className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm font-medium transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
