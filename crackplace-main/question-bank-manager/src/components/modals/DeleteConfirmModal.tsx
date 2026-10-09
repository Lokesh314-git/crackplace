import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Question } from '../../types';
import { getSubjectDetails } from '../../constants/subjects';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { questionService } from '../../services/questionService';

interface DeleteConfirmModalProps {
  question: Question | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (deletedId: string) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  question,
  isOpen,
  onClose,
  onDeleted
}) => {
  if (!question) return null;

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjectInfo = getSubjectDetails(question.subject);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError(null);
      await questionService.deleteQuestion(question.id);
      onDeleted(question.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete question');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Permanently Delete Question</span>
        </div>
      }
      subtitle="This action cannot be undone. It will remove the question from the database."
      maxWidth="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Question Details Card */}
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
          <div className="flex items-center justify-between font-mono">
            <span className="font-bold text-slate-900 dark:text-white">
              {question.question_id}
            </span>
            <span className="text-slate-500">{subjectInfo.name}</span>
          </div>
          <div className="text-slate-700 dark:text-slate-300 line-clamp-3 italic">
            "{question.question}"
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Are you sure you want to permanently delete this question from Supabase? Students will no longer receive this question in upcoming practice sessions or battles.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Permanently</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
