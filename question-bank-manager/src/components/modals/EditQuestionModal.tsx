import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Question, QuestionUpdate, QuestionDifficulty, QuestionType, Subject } from '../../types';
import { validateQuestionForm } from '../../utils/validation';
import { DEFAULT_SUBJECTS } from '../../constants/subjects';
import { questionService } from '../../services/questionService';
import { AlertCircle, Loader2, Save } from 'lucide-react';

interface EditQuestionModalProps {
  question: Question | null;
  isOpen: boolean;
  subjects: Subject[];
  onClose: () => void;
  onSave: (updated: Question) => void;
}

export const EditQuestionModal: React.FC<EditQuestionModalProps> = ({
  question,
  isOpen,
  subjects,
  onClose,
  onSave
}) => {
  if (!question) return null;

  const [formData, setFormData] = useState<QuestionUpdate>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (question) {
      setFormData({
        question_id: question.question_id,
        subject: question.subject,
        topic: question.topic || '',
        subtopic: question.subtopic || '',
        difficulty: question.difficulty,
        question_type: question.question_type,
        question: question.question,
        option_a: question.option_a || '',
        option_b: question.option_b || '',
        option_c: question.option_c || '',
        option_d: question.option_d || '',
        correct_answer: question.correct_answer || '',
        explanation: question.explanation || '',
        source: question.source || ''
      });
      setErrors({});
      setApiError(null);
    }
  }, [question]);

  const [availableTopics, setAvailableTopics] = useState<string[]>([]);

  useEffect(() => {
    if (formData.subject) {
      questionService.getTopics(formData.subject).then(setAvailableTopics).catch(() => setAvailableTopics([]));
    } else {
      setAvailableTopics([]);
    }
  }, [formData.subject]);

  const handleChange = (field: keyof QuestionUpdate, value: string) => {
    setFormData((prev) => ({ 
      ...prev, 
      [field]: value,
      ...(field === 'subject' && { topic: '' }) // Reset topic if subject changes
    }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const validation = validateQuestionForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      setSaving(true);
      const updated = await questionService.updateQuestion(question.id, formData);
      onSave(updated);
      onClose();
    } catch (err: any) {
      setApiError(err.message || 'Failed to update question');
    } finally {
      setSaving(false);
    }
  };

  const allSubjects = subjects.length > 0 ? subjects : DEFAULT_SUBJECTS;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Edit Question</span>
          <span className="font-mono text-indigo-600 dark:text-indigo-400 text-sm">
            ({question.question_id})
          </span>
        </div>
      }
      subtitle="Modify question metadata, content, and options"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {apiError && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Row 1: Identification & Classification */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Question ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.question_id || ''}
              onChange={(e) => handleChange('question_id', e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-lg border font-mono uppercase ${
                errors.question_id
                  ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/20'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
              } focus:ring-2 focus:ring-indigo-500 focus:outline-none`}
            />
            {errors.question_id && (
              <p className="text-[11px] text-rose-500 mt-1">{errors.question_id}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.subject || ''}
              onChange={(e) => handleChange('subject', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {allSubjects.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Difficulty <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.difficulty || 'Easy'}
              onChange={(e) => handleChange('difficulty', e.target.value as QuestionDifficulty)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>

        {/* Row 2: Topic, Subtopic, Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Topic
            </label>
            <input
              type="text"
              list="edit-topic-options"
              value={formData.topic || ''}
              onChange={(e) => handleChange('topic', e.target.value)}
              placeholder="e.g. Dynamic Programming, SQL Joins"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <datalist id="edit-topic-options">
              {availableTopics.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subtopic
            </label>
            <input
              type="text"
              value={formData.subtopic || ''}
              onChange={(e) => handleChange('subtopic', e.target.value)}
              placeholder="e.g. Knapsack, Left Outer Join"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Question Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.question_type || 'MCQ'}
              onChange={(e) => handleChange('question_type', e.target.value as QuestionType)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="MCQ">MCQ (Multiple Choice)</option>
              <option value="INTERVIEW">INTERVIEW (Open-ended / HR)</option>
            </select>
          </div>
        </div>

        {/* Row 3: Question Text */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Question Statement <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={4}
            value={formData.question || ''}
            onChange={(e) => handleChange('question', e.target.value)}
            className={`w-full px-3 py-2 text-xs rounded-lg border ${
              errors.question
                ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/20'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
            } focus:ring-2 focus:ring-indigo-500 focus:outline-none`}
          />
          {errors.question && (
            <p className="text-[11px] text-rose-500 mt-1">{errors.question}</p>
          )}
        </div>

        {/* Row 4: MCQ Options (Conditional) */}
        {formData.question_type === 'MCQ' && (
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Multiple Choice Options
              </span>
              <span className="text-[11px] text-slate-500">All 4 options required</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['A', 'B', 'C', 'D'] as const).map((key) => {
                const optKey = `option_${key.toLowerCase()}` as keyof QuestionUpdate;
                return (
                  <div key={key}>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Option {key} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={(formData[optKey] as string) || ''}
                      onChange={(e) => handleChange(optKey, e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-lg border ${
                        errors[optKey]
                          ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/20'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                      } focus:ring-2 focus:ring-indigo-500 focus:outline-none`}
                    />
                    {errors[optKey] && (
                      <p className="text-[11px] text-rose-500 mt-0.5">{errors[optKey]}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Correct Answer Option <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-4">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                  <label
                    key={opt}
                    className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-bold transition-all ${
                      formData.correct_answer === opt
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="correct_answer"
                      value={opt}
                      checked={formData.correct_answer === opt}
                      onChange={(e) => handleChange('correct_answer', e.target.value)}
                      className="sr-only"
                    />
                    <span>Option {opt}</span>
                  </label>
                ))}
              </div>
              {errors.correct_answer && (
                <p className="text-[11px] text-rose-500 mt-1">{errors.correct_answer}</p>
              )}
            </div>
          </div>
        )}

        {/* Row 5: Explanation & Source */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Explanation / Solution Guide
            </label>
            <textarea
              rows={3}
              value={formData.explanation || ''}
              onChange={(e) => handleChange('explanation', e.target.value)}
              placeholder="Detailed step-by-step reasoning or interview answer key..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Source / Reference
            </label>
            <input
              type="text"
              value={formData.source || ''}
              onChange={(e) => handleChange('source', e.target.value)}
              placeholder="e.g. TCS NQT 2024, LeetCode"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
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
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
