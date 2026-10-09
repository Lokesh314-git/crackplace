export interface SubjectMetadata {
  id: string;
  slug: string;
  name: string;
  code_prefix: string;
  description: string;
  display_order: number;
  is_active: boolean;
  color: string;
  badgeBg: string;
  iconName: string;
}

export const DEFAULT_SUBJECTS: SubjectMetadata[] = [
  {
    id: 'sub-1',
    slug: 'quantitative_aptitude',
    name: 'Quantitative Aptitude',
    code_prefix: 'QA',
    description: 'Percentages, profit & loss, time & work, probability, algebra, and numbers.',
    display_order: 1,
    is_active: true,
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    iconName: 'Calculator'
  },
  {
    id: 'sub-2',
    slug: 'dsa',
    name: 'Data Structures & Algorithms',
    code_prefix: 'DSA',
    description: 'Arrays, linked lists, trees, graphs, sorting, dynamic programming, and complexity.',
    display_order: 2,
    is_active: true,
    color: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    iconName: 'Binary'
  },
  {
    id: 'sub-3',
    slug: 'dbms',
    name: 'DBMS',
    code_prefix: 'DBMS',
    description: 'SQL queries, ACID properties, normalization, indexing, and transactions.',
    display_order: 3,
    is_active: true,
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    iconName: 'Database'
  },
  {
    id: 'sub-4',
    slug: 'operating_system',
    name: 'Operating Systems',
    code_prefix: 'OS',
    description: 'Processes, threads, CPU scheduling, memory management, and deadlocks.',
    display_order: 4,
    is_active: true,
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    iconName: 'Cpu'
  },
  {
    id: 'sub-5',
    slug: 'computer_network',
    name: 'Computer Networks',
    code_prefix: 'CN',
    description: 'OSI model, TCP/IP, IP addressing, routing, protocols, and network security.',
    display_order: 5,
    is_active: true,
    color: 'text-cyan-600 dark:text-cyan-400',
    badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
    iconName: 'Network'
  },
  {
    id: 'sub-6',
    slug: 'logical_reasoning',
    name: 'Logical Reasoning & Puzzles',
    code_prefix: 'LR',
    description: 'Deductive logic, syllogisms, blood relations, seating arrangements, and sequences.',
    display_order: 6,
    is_active: true,
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    iconName: 'Brain'
  },
  {
    id: 'sub-7',
    slug: 'verbal_ability',
    name: 'Verbal Ability & English',
    code_prefix: 'VA',
    description: 'Grammar rules, reading comprehension, vocabulary, para-jumbles, and error spotting.',
    display_order: 7,
    is_active: true,
    color: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    iconName: 'BookOpen'
  },
  {
    id: 'sub-8',
    slug: 'hr_behavioral',
    name: 'HR & Behavioral Interview',
    code_prefix: 'HR',
    description: 'STAR interview framework questions, situational judgement, and leadership scenarios.',
    display_order: 8,
    is_active: true,
    color: 'text-teal-600 dark:text-teal-400',
    badgeBg: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
    iconName: 'Users'
  }
];

export const SUBJECT_MAP = new Map<string, SubjectMetadata>(
  DEFAULT_SUBJECTS.map((s) => [s.slug, s])
);

export function getSubjectDetails(slug: string): SubjectMetadata {
  const found = SUBJECT_MAP.get(slug);
  if (found) return found;

  const formattedName = slug
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    id: `sub-custom-${slug}`,
    slug,
    name: formattedName,
    code_prefix: slug.slice(0, 3).toUpperCase(),
    description: '',
    display_order: 99,
    is_active: true,
    color: 'text-slate-600 dark:text-slate-400',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    iconName: 'Folder'
  };
}
