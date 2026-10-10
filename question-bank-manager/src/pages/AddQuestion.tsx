import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowLeft,
  Wand2,
  Layers,
  HelpCircle
} from 'lucide-react';
import { questionService } from '../services/questionService';
import {
  QuestionInsert,
  QuestionDifficulty,
  QuestionType,
  Subject
} from '../types';
import { validateQuestionForm } from '../utils/validation';
import { DEFAULT_SUBJECTS } from '../constants/subjects';

export const AddQuestion: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [formData, setFormData] = useState<QuestionInsert>({
    question_id: 'QA0001',
    subject: 'quantitative_aptitude',
    topic: '',
    subtopic: '',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A',
    explanation: '',
    source: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    questionService.getSubjects().then((subs) => {
      setSubjects(subs);
      if (subs.length > 0) {
        handleSubjectChange(subs[0].slug, subs);
      }
    });
  }, []);

  const [availableTopics, setAvailableTopics] = useState<string[]>([]);

  const handleSubjectChange = (subjectSlug: string, currentSubjects = subjects) => {
    const sub = currentSubjects.find((s) => s.slug === subjectSlug) || DEFAULT_SUBJECTS.find((s) => s.slug === subjectSlug);
    const prefix = sub?.code_prefix || 'Q';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generatedId = `${prefix}${randomNum}`;

    setFormData((prev) => ({
      ...prev,
      subject: subjectSlug,
      question_id: generatedId,
      topic: '' // reset topic when subject changes
    }));
    
    questionService.getTopics(subjectSlug).then(setAvailableTopics).catch(() => setAvailableTopics([]));
  };

  const handleChange = (field: keyof QuestionInsert, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleAutoGenerateId = () => {
    const sub = subjects.find((s) => s.slug === formData.subject) || DEFAULT_SUBJECTS.find((s) => s.slug === formData.subject);
    const prefix = sub?.code_prefix || 'Q';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    handleChange('question_id', `${prefix}${randomNum}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setSuccessMessage(null);

    const validation = validateQuestionForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      setSaving(true);
      await questionService.createQuestion(formData);
      setSuccessMessage(`Question "${formData.question_id}" added successfully into Supabase.`);

      // Prepare form for next entry with fresh generated ID
      const sub = subjects.find((s) => s.slug === formData.subject) || DEFAULT_SUBJECTS.find((s) => s.slug === formData.subject);
      const prefix = sub?.code_prefix || 'Q';
      const randomNum = Math.floor(1000 + Math.random() * 9000);

      setFormData((prev) => ({
        ...prev,
        question_id: `${prefix}${randomNum}`,
        question: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        explanation: '',
        source: ''
      }));
      setErrors({});
    } catch (err: any) {
      setApiError(err.message || 'Failed to insert question');
    } finally {
      setSaving(false);
    }
  };

  const allSubjects = subjects.length > 0 ? subjects : DEFAULT_SUBJECTS;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Navigation & Title */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/questions')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Question Bank
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Manual Question Entry
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Insert a single verified placement question directly into Supabase PostgreSQL
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            onClick={() => navigate('/questions')}
            className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline whitespace-nowrap"
          >
            View in Table →
          </button>
        </div>
      )}

      {/* Error Alert */}
      {apiError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Add Form Card */}
      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6"
      >
        {/* Section 1: Subject, Classification & Human ID */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              1. Subject & Classification
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {allSubjects.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Question ID */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Question ID <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerateId}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                  title="Generate new random ID"
                >
                  <Wand2 className="w-3 h-3" /> Auto
                </button>
              </div>
              <input
                type="text"
                value={formData.question_id}
                onChange={(e) => handleChange('question_id', e.target.value)}
                placeholder="e.g. QA0001, DSA0042"
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

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Difficulty Level <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) => handleChange('difficulty', e.target.value as QuestionDifficulty)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Topic */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Topic
              </label>
              <input
                type="text"
                list="topic-options"
                value={formData.topic || ''}
                onChange={(e) => handleChange('topic', e.target.value)}
                placeholder="e.g. Time & Work, Graphs, Normalization"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <datalist id="topic-options">
                {availableTopics.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>

            {/* Subtopic */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subtopic
              </label>
              <input
                type="text"
                value={formData.subtopic || ''}
                onChange={(e) => handleChange('subtopic', e.target.value)}
                placeholder="e.g. Pipes & Cisterns, Dijkstra, 3NF"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Question Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Question Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.question_type}
                onChange={(e) => handleChange('question_type', e.target.value as QuestionType)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="MCQ">MCQ (Multiple Choice 4 Options)</option>
                <option value="INTERVIEW">INTERVIEW / HR (Open Ended)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Question Statement */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              2. Question Content
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Question Statement <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={formData.question}
              onChange={(e) => handleChange('question', e.target.value)}
              placeholder="Enter the full, precise question text..."
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
        </div>

        {/* Section 3: Options (Only for MCQ) */}
        {formData.question_type === 'MCQ' && (
          <div className="space-y-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                3. Multiple Choice Options (4 required)
              </span>
              <span className="text-[11px] text-slate-500">Select correct option below</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['A', 'B', 'C', 'D'] as const).map((key) => {
                const optKey = `option_${key.toLowerCase()}` as keyof QuestionInsert;
                return (
                  <div key={key}>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Option {key} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={(formData[optKey] as string) || ''}
                      onChange={(e) => handleChange(optKey, e.target.value)}
                      placeholder={`Enter text for Option ${key}`}
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

            {/* Correct Answer Selection */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Mark Correct Answer Option <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-bold transition-all ${
                      formData.correct_answer === opt
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
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

        {/* Section 4: Solution & Explanation */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              4. Explanation & Reference
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Detailed Explanation / Solution
              </label>
              <textarea
                rows={3}
                value={formData.explanation || ''}
                onChange={(e) => handleChange('explanation', e.target.value)}
                placeholder="Step-by-step mathematical derivation, algorithm complexity, or interview rubric..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Source
              </label>
              <input
                type="text"
                value={formData.source || ''}
                onChange={(e) => handleChange('source', e.target.value)}
                placeholder="e.g. Infosys 2024, Gate CS"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Form Submission Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => navigate('/questions')}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs shadow-indigo-600/20 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Inserting into Supabase...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Add Question to Bank</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
