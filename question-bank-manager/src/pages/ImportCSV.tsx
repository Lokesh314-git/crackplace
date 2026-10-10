import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileUp,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  Check,
  UploadCloud
} from 'lucide-react';
import { csvService, CSV_EXPECTED_HEADERS } from '../services/csvService';
import { questionService } from '../services/questionService';
import {
  CSVValidationSummary,
  CSVImportProgress,
  QuestionInsert
} from '../types';
import { Badge } from '../components/ui/Badge';

export const ImportCSV: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [summary, setSummary] = useState<CSVValidationSummary | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'valid' | 'invalid' | 'duplicate'>('all');
  const [onConflictOption, setOnConflictOption] = useState<'skip' | 'update'>('skip');

  const [importProgress, setImportProgress] = useState<CSVImportProgress>({
    totalToImport: 0,
    processedCount: 0,
    successfulCount: 0,
    failedCount: 0,
    currentBatch: 0,
    totalBatches: 0,
    status: 'idle'
  });

  const [dragActive, setDragActive] = useState(false);
  const [subjects, setSubjects] = React.useState<any[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [defaultSubject, setDefaultSubject] = useState('');
  const [defaultTopic, setDefaultTopic] = useState('');

  React.useEffect(() => {
    questionService.getSubjects().then((subs) => setSubjects(subs));
  }, []);

  React.useEffect(() => {
    if (defaultSubject) {
      questionService.getTopics(defaultSubject).then(setAvailableTopics).catch(() => setAvailableTopics([]));
    } else {
      setAvailableTopics([]);
    }
    setDefaultTopic('');
  }, [defaultSubject]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (dropped.name.endsWith('.csv') || dropped.type === 'text/csv') {
        processFile(dropped);
      } else {
        alert('Please upload a valid .csv file.');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (selectedFile: File) => {
    setSummary(null);
    setParsing(true);

    try {
      const res = await csvService.parseAndValidate(selectedFile, defaultSubject, defaultTopic);
      setSummary(res);
    } catch (err: any) {
      alert(`CSV parsing failed: ${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  const handleStartImport = async () => {
    if (!summary) return;

    // Filter valid rows ready for insertion
    const validRowsToImport: QuestionInsert[] = summary.rows
      .filter((r) => r.status === 'valid')
      .map((r) => r.normalized as QuestionInsert);

    if (validRowsToImport.length === 0) {
      alert('There are no valid rows to import in this CSV file.');
      return;
    }

    const total = validRowsToImport.length;
    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(total / BATCH_SIZE);

    setImportProgress({
      totalToImport: total,
      processedCount: 0,
      successfulCount: 0,
      failedCount: 0,
      currentBatch: 1,
      totalBatches,
      status: 'importing'
    });

    try {
      const result = await questionService.bulkInsertQuestions(
        validRowsToImport,
        (processed) => {
          setImportProgress((prev) => ({
            ...prev,
            processedCount: processed,
            currentBatch: Math.min(totalBatches, Math.floor(processed / BATCH_SIZE) + 1)
          }));
        },
        onConflictOption
      );

      setImportProgress((prev) => ({
        ...prev,
        status: 'completed',
        successfulCount: result.inserted,
        failedCount: validRowsToImport.length - result.inserted,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : undefined
      }));
    } catch (err: any) {
      setImportProgress((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err.message || 'Database bulk insertion failed'
      }));
    }
  };

  // Filtered rows for preview table
  const displayedRows = (summary?.rows || []).filter((r) => {
    if (filterTab === 'all') return true;
    return r.status === filterTab;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Title and Template Downloads */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Bulk CSV Import Pipeline
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Validate, detect duplicates, and batch-import large question sets into Supabase PostgreSQL
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => csvService.downloadTemplate()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV Template</span>
          </button>
          <button
            onClick={() => csvService.downloadSampleCSV()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Download Sample CSV</span>
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      {!summary && !parsing && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Optional: Set Default Subject & Topic</h3>
            <p className="text-xs text-slate-500">
              Questions in the CSV will inherit these selections unless the row explicitly provides a different subject or topic.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Default Subject
                </label>
                <select
                  value={defaultSubject}
                  onChange={(e) => setDefaultSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                >
                  <option value="">-- None (Read from CSV) --</option>
                  {subjects.map((sub: any) => (
                    <option key={sub.slug} value={sub.slug}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Default Topic
                </label>
                <input
                  type="text"
                  list="import-topic-options"
                  value={defaultTopic}
                  onChange={(e) => setDefaultTopic(e.target.value)}
                  placeholder="e.g. Arrays, Strings"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors placeholder:text-slate-400"
                />
                <datalist id="import-topic-options">
                  {availableTopics.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
            </div>
          </div>
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`p-10 border-2 border-dashed rounded-2xl text-center transition-all ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
              <UploadCloud className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Upload Questions CSV
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Drag and drop your file here, or click browse (supports 10,000+ rows)
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all"
            >
              <FileUp className="w-4 h-4" />
              <span>Browse CSV File</span>
            </button>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              Columns: <code className="text-indigo-600 dark:text-indigo-400">{CSV_EXPECTED_HEADERS.join(', ')}</code>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Parsing Loader */}
      {parsing && (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Validating & Normalizing CSV Dataset...
          </h3>
          <p className="text-xs text-slate-500">
            Checking mandatory fields, option counts, valid subjects, and intra-file duplicates.
          </p>
        </div>
      )}

      {/* Validation Summary & Preview Section */}
      {summary && importProgress.status === 'idle' && (
        <div className="space-y-6">
          {/* Missing Headers Warning */}
          {summary.missingRequiredHeaders.length > 0 && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <div>
                <span className="font-bold">Missing Required Headers:</span> This CSV lacks essential columns:{' '}
                <span className="font-mono">{summary.missingRequiredHeaders.join(', ')}</span>. Please fix the headers and re-upload.
              </div>
            </div>
          )}

          {/* Validation Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Rows
              </span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {summary.totalRows.toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Valid Rows
              </span>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {summary.validCount.toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60">
              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Invalid Rows
              </span>
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">
                {summary.invalidCount.toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60">
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Duplicates
              </span>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                {summary.duplicateCount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Import Controls Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Duplicate Handling Strategy
              </h4>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicate_strategy"
                    value="skip"
                    checked={onConflictOption === 'skip'}
                    onChange={() => setOnConflictOption('skip')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Skip Duplicate Question IDs (Default)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicate_strategy"
                    value="update"
                    checked={onConflictOption === 'update'}
                    onChange={() => setOnConflictOption('update')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Update Existing Rows</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSummary(null);
                }}
                className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel & Re-upload
              </button>

              {summary.invalidCount > 0 && (
                <button
                  type="button"
                  onClick={() => csvService.downloadErrorReport(summary)}
                  className="px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 rounded-lg transition-colors"
                >
                  Download Error Report
                </button>
              )}

              <button
                type="button"
                onClick={handleStartImport}
                disabled={summary.validCount === 0}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-xs shadow-emerald-600/20 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Import {summary.validCount.toLocaleString()} Valid Rows (500/Batch)</span>
              </button>
            </div>
          </div>

          {/* Preview Table Header Tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 w-full">
                {[
                  { key: 'all', label: `All Rows (${summary.totalRows})` },
                  { key: 'valid', label: `Valid (${summary.validCount})` },
                  { key: 'invalid', label: `Invalid (${summary.invalidCount})` },
                  { key: 'duplicate', label: `Duplicates (${summary.duplicateCount})` }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilterTab(tab.key as any)}
                    className={`pb-2.5 px-3 text-xs font-semibold transition-colors border-b-2 ${
                      filterTab === tab.key
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto max-h-[450px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-10">
                    <tr className="text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Row #</th>
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Difficulty</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Question Preview</th>
                      <th className="py-2.5 px-3">Validation Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedRows.slice(0, 150).map((r) => (
                      <tr
                        key={r.rowIndex}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          r.status === 'invalid'
                            ? 'bg-rose-50/20'
                            : r.status === 'duplicate'
                            ? 'bg-amber-50/20'
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          #{r.rowIndex}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {r.raw.id || r.raw.question_id || 'AUTO'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                          {r.raw.subject || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[11px] font-medium">{r.raw.difficulty || '—'}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={
                              r.status === 'valid'
                                ? 'success'
                                : r.status === 'duplicate'
                                ? 'warning'
                                : 'danger'
                            }
                            size="sm"
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 max-w-xs truncate text-slate-800 dark:text-slate-200">
                          {r.raw.question || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-sm">
                          {r.errors.length > 0 ? (
                            <span className="text-rose-600 font-medium">{r.errors.join('; ')}</span>
                          ) : r.warnings.length > 0 ? (
                            <span className="text-amber-600">{r.warnings.join('; ')}</span>
                          ) : (
                            <span className="text-emerald-600">Passed checks</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {displayedRows.length > 150 && (
                <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                  Showing first 150 of {displayedRows.length} rows in preview. All valid rows will be imported during execution.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Import Progress & Completion Screen */}
      {(importProgress.status === 'importing' ||
        importProgress.status === 'completed' ||
        importProgress.status === 'error') && (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            {importProgress.status === 'importing' && (
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            )}
            {importProgress.status === 'completed' && (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            )}
            {importProgress.status === 'error' && (
              <XCircle className="w-6 h-6 text-rose-600" />
            )}

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {importProgress.status === 'importing'
                  ? 'Executing Batch Insertion into Supabase...'
                  : importProgress.status === 'completed'
                  ? 'Batch Import Successfully Completed'
                  : 'Import Encountered an Error'}
              </h3>
              <p className="text-xs text-slate-500">
                {importProgress.status === 'importing'
                  ? `Processing Batch ${importProgress.currentBatch} of ${importProgress.totalBatches} (500 rows/batch)`
                  : `${importProgress.successfulCount.toLocaleString()} questions synchronized into PostgreSQL`}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-400">
                Progress: {importProgress.processedCount.toLocaleString()} /{' '}
                {importProgress.totalToImport.toLocaleString()}
              </span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                {Math.round(
                  (importProgress.processedCount / (importProgress.totalToImport || 1)) * 100
                )}
                %
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    (importProgress.processedCount / (importProgress.totalToImport || 1)) * 100
                  }%`
                }}
              />
            </div>
          </div>

          {importProgress.errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {importProgress.errorMessage}
            </div>
          )}

          {importProgress.status === 'completed' && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSummary(null);
                  setImportProgress({
                    totalToImport: 0,
                    processedCount: 0,
                    successfulCount: 0,
                    failedCount: 0,
                    currentBatch: 0,
                    totalBatches: 0,
                    status: 'idle'
                  });
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Import Another CSV
              </button>
              <button
                type="button"
                onClick={() => navigate('/questions')}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs transition-colors"
              >
                <span>View Questions in Bank</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
