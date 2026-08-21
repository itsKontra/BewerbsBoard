import React, { useState, useRef } from 'react';
import { uiText } from '../../../../ui-text';
import type { DataExportEnvelope, PreflightSummary } from '../../../../../shared/domain/data-management';
import { AdminCard } from '../AdminCard';
import { Download, Upload, FileText, CheckCircle2, AlertTriangle, X, Loader2, Info } from 'lucide-react';

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
    <div className="space-y-6">
      {/* Header Description */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 tracking-wide flex items-center gap-2">
          <span>{t.title}</span>
        </h3>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          {t.description}
        </p>
      </div>

      {/* 1. EXPORT SECTION */}
      <AdminCard>
        <div className="mb-4">
          <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Download size={18} className="text-indigo-600" />
            <span>{t.exportTitle}</span>
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {t.exportDescription}
          </p>
        </div>

        {exportError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between mb-4">
            <span>{exportError}</span>
            <button type="button" onClick={() => setExportError(null)} className="text-red-400 hover:text-red-700">✕</button>
          </div>
        )}

        {exportSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between mb-4">
            <span>{exportSuccess}</span>
            <button type="button" onClick={() => setExportSuccess(null)} className="text-emerald-400 hover:text-emerald-700">✕</button>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl text-sm transition-all shadow-sm shadow-indigo-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {exporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t.exporting}</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>{t.exportButton}</span>
              </>
            )}
          </button>
        </div>
      </AdminCard>

      {/* 2. IMPORT SECTION */}
      <AdminCard className="space-y-6">
        <div>
          <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Upload size={18} className="text-indigo-600" />
            <span>{t.importTitle}</span>
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {t.importDescription}
          </p>
        </div>

        {importSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl text-sm flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={18} />
              <span>{importSuccess}</span>
            </div>
            <button type="button" onClick={() => setImportSuccess(null)} className="text-emerald-400 hover:text-emerald-700">
              <X size={16} />
            </button>
          </div>
        )}

        {importError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle size={18} />
              <span>{importError}</span>
            </div>
            <button type="button" onClick={() => setImportError(null)} className="text-red-400 hover:text-red-700">
              <X size={16} />
            </button>
          </div>
        )}

        {/* File dropzone / selector */}
        {!preflightSummary && (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-10 text-center transition-all bg-slate-50 hover:bg-indigo-50/20 flex flex-col items-center justify-center space-y-3 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="p-4 bg-white rounded-2xl shadow-sm text-indigo-600 border border-slate-100">
              <FileText size={32} />
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {preflightLoading ? t.analyzingFile : t.selectFile}
            </div>
            <div className="text-xs text-slate-400">
              {t.dragDropHint} (.json)
            </div>
          </div>
        )}

        {/* Preflight Errors Box */}
        {preflightErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl space-y-2">
            <div className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{t.preflightInvalid}</span>
            </div>
            <ul className="text-xs space-y-1 pl-5 list-disc text-red-600">
              {preflightErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetImport}
                className="px-3.5 py-1.5 bg-white border border-red-200 hover:bg-red-100/50 text-red-700 text-xs rounded-xl font-semibold transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Preflight Success & Summary Table */}
        {preflightSummary && preflightSummary.isValid && (
          <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h5 className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{t.preflightValid}</span>
                </h5>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {selectedFile?.name} ({t.totalEntities(preflightSummary.totalEntities)})
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetImport}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                {t.cancel}
              </button>
            </div>

            {/* Table Breakdown */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-2.5">{t.tableHeaderEntity}</th>
                    <th className="px-4 py-2.5 text-center">{t.tableHeaderTotal}</th>
                    <th className="px-4 py-2.5 text-center text-emerald-700">{t.tableHeaderNew}</th>
                    <th className="px-4 py-2.5 text-center text-amber-700">{t.tableHeaderUpdate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { label: t.entityAppConfig, count: preflightSummary.summary.appConfig },
                    { label: t.entityCompetitionClasses, count: preflightSummary.summary.competitionClasses },
                    { label: t.entityFireBrigades, count: preflightSummary.summary.fireBrigades },
                    { label: t.entityCategoryTypes, count: preflightSummary.summary.categoryTypes },
                    { label: t.entityEvaluationTypes, count: preflightSummary.summary.evaluationTypes },
                    { label: t.entityGroups, count: preflightSummary.summary.groups },
                    { label: t.entityCategoryEntries, count: preflightSummary.summary.categoryEntries },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-medium text-slate-700">{row.label}</td>
                      <td className="px-4 py-2 text-center font-mono text-slate-500">{row.count.total}</td>
                      <td className="px-4 py-2 text-center font-mono text-emerald-700 font-semibold">{row.count.toInsert}</td>
                      <td className="px-4 py-2 text-center font-mono text-amber-700 font-semibold">{row.count.toUpdate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-500 flex items-start gap-2">
              <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <span>{t.warningNote}</span>
            </div>

            {/* Confirmation & Import Trigger */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={importing}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl text-sm transition-all shadow-sm shadow-indigo-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {importing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{t.importing}</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>{t.importButton}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleResetImport}
                disabled={importing}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-sm font-medium transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
