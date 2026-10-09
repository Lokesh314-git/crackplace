import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Subject, SubjectInsert } from '../../types';
import { questionService } from '../../services/questionService';
import { AlertCircle, Layers, Loader2, Plus } from 'lucide-react';

interface AddSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubjectAdded: (subject: Subject) => void;
}

export const AddSubjectModal: React.FC<AddSubjectModalProps> = ({
  isOpen,
  onClose,
  onSubjectAdded
}) => {
  const [formData, setFormData] = useState<SubjectInsert>({
    slug: '',
    name: '',
    code_prefix: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    // Auto-generate slug and prefix from name if not manually modified
    const autoSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_|_$)/g, '');
    const autoPrefix = val
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4);

    setFormData((prev) => ({
      ...prev,
      name: val,
      slug: prev.slug === '' || prev.slug === autoSlug.slice(0, -1) ? autoSlug : prev.slug,
      code_prefix: prev.code_prefix === '' || prev.code_prefix === autoPrefix.slice(0, -1) ? autoPrefix : prev.code_prefix
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Subject Name is required');
      return;
    }
    if (!formData.slug.trim()) {
      setError('Subject Identifier (slug) is required');
      return;
    }
    if (!formData.code_prefix.trim()) {
      setError('Code Prefix is required (e.g., QA, DSA, OS)');
      return;
    }

    try {
      setSaving(true);
      const newSubject = await questionService.createSubject({
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        code_prefix: formData.code_prefix.trim().toUpperCase(),
        description: formData.description?.trim() || undefined
      });
      onSubjectAdded(newSubject);
      onClose();
      setFormData({ slug: '', name: '', code_prefix: '', description: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to add subject');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>Add New Subject</span>
        </div>
      }
      subtitle="Register a new placement subject in Supabase"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Subject Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Cloud Computing & DevOps"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Identifier Slug <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. cloud_devops"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Code Prefix <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. CLD, DEV"
              value={formData.code_prefix}
              onChange={(e) =>
                setFormData({ ...formData, code_prefix: e.target.value.toUpperCase() })
              }
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Description
          </label>
          <textarea
            rows={2}
            placeholder="Optional overview of topics covered in this subject..."
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subject</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
