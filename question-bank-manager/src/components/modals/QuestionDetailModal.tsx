import React from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Question } from '../../types';
import { getSubjectDetails } from '../../constants/subjects';
import { CheckCircle2, Copy, Tag } from 'lucide-react';

interface QuestionDetailModalProps {
  question: Question | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (question: Question) => void;
}

export const QuestionDetailModal: React.FC<QuestionDetailModalProps> = ({
  question,
  isOpen,
  onClose,
  onEdit
}) => {
  if (!question) return null;

  const subjectInfo = getSubjectDetails(question.subject);

  const getDifficultyVariant = (diff: string) => {
    switch (diff) {
      case 'Easy':
        return 'success';
      case 'Medium':
        return 'warning';
      case 'Hard':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
            {question.question_id}
          </span>
          <span className="text-slate-400 font-normal">|</span>
          <span className="text-sm font-semibold">{subjectInfo.name}</span>
        </div>
      }
      subtitle={`Internal Database UUID: ${question.id}`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Badge variant={getDifficultyVariant(question.difficulty)}>
            {question.difficulty}
          </Badge>
          <Badge variant={question.question_type === 'MCQ' ? 'primary' : 'purple'}>
            {question.question_type}
          </Badge>
          {question.topic && (
            <Badge variant="neutral">
              <Tag className="w-3 h-3" />
              {question.topic}
            </Badge>
          )}
          {question.subtopic && (
            <span className="text-xs text-slate-500 font-medium">
              › {question.subtopic}
            </span>
          )}
        </div>

        {/* Question Statement */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Question Statement</span>
            <button
              onClick={() => copyToClipboard(question.question)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors inline-flex items-center gap-1 text-[11px] font-normal"
              title="Copy question text"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </label>
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
            {question.question}
          </div>
        </div>

        {/* Options for MCQ */}
        {question.question_type === 'MCQ' && (
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Multiple Choice Options
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(['A', 'B', 'C', 'D'] as const).map((key) => {
                const optKey = `option_${key.toLowerCase()}` as keyof Question;
                const optVal = question[optKey] as string | null;
                const isCorrect = question.correct_answer === key;

                return (
                  <div
                    key={key}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-xs transition-all ${
                      isCorrect
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 font-medium ring-1 ring-emerald-400/30'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-bold shrink-0 text-xs ${
                        isCorrect
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {key}
                    </span>
                    <div className="flex-1 break-words leading-tight pt-0.5">
                      {optVal || <span className="text-slate-400 italic">None</span>}
                    </div>
                    {isCorrect && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Correct Answer & Explanation */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {question.question_type === 'MCQ' ? 'Explanation & Solution' : 'Model Answer & Rubric'}
          </label>
          <div className="p-4 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
            {question.explanation ? (
              question.explanation
            ) : (
              <span className="text-slate-400 italic">No explanation provided.</span>
            )}
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <div>
            <span className="block font-medium text-slate-400">Source:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {question.source || 'Standard Repository'}
            </span>
          </div>
          <div>
            <span className="block font-medium text-slate-400">Created:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {new Date(question.created_at).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="block font-medium text-slate-400">Last Updated:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {new Date(question.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(question);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              Edit Question
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
