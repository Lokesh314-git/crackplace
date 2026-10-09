export interface SubjectConfig {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  iconName: string;
  badge: string;
  targetCompanies: string;
  defaultTopics: string[];
}

export const SUBJECTS: Record<string, SubjectConfig> = {
  quantitative_aptitude: {
    slug: 'quantitative_aptitude',
    name: 'Quantitative Aptitude',
    shortName: 'Aptitude',
    description: 'Arithmetic, Percentages, Time & Work, Speed, Geometry, Probability, and Number Theory.',
    iconName: 'FaCalculator',
    badge: 'High Priority',
    targetCompanies: 'TCS, Infosys, Wipro, Accenture',
    defaultTopics: ['Percentages', 'Profit & Loss', 'Time & Work', 'Speed, Distance & Time', 'Ratio & Proportion', 'Probability', 'Permutation & Combination', 'Number Systems', 'Averages', 'Simple & Compound Interest']
  },
  dsa: {
    slug: 'dsa',
    name: 'Data Structures & Algorithms',
    shortName: 'DSA',
    description: 'Arrays, Strings, Linked Lists, Trees, Graphs, Dynamic Programming, Heaps, and Recursion.',
    iconName: 'FaCode',
    badge: 'Core Technical',
    targetCompanies: 'Amazon, Microsoft, Google, Adobe',
    defaultTopics: ['Arrays', 'Strings', 'Linked Lists', 'Trees & BST', 'Graphs', 'Dynamic Programming', 'Stacks & Queues', 'Sorting & Searching', 'Recursion & Backtracking', 'Heaps & Hash Tables']
  },
  dbms: {
    slug: 'dbms',
    name: 'Database Management Systems',
    shortName: 'DBMS',
    description: 'SQL queries, Normalization, ACID properties, Indexing, Transactions, and ER modeling.',
    iconName: 'FaDatabase',
    badge: 'CS Core',
    targetCompanies: 'Oracle, Cisco, Morgan Stanley',
    defaultTopics: ['SQL Queries', 'Normalization (1NF-BCNF)', 'Transactions & ACID', 'Indexing & B-Trees', 'ER Modeling', 'Joins & Subqueries', 'Concurrency Control', 'NoSQL Fundamentals']
  },
  operating_system: {
    slug: 'operating_system',
    name: 'Operating Systems',
    shortName: 'OS',
    description: 'Process synchronization, Deadlocks, Memory Management, Paging, CPU Scheduling & Threads.',
    iconName: 'FaServer',
    badge: 'CS Core',
    targetCompanies: 'Qualcomm, Intel, Samsung, Cisco',
    defaultTopics: ['CPU Scheduling', 'Process Synchronization', 'Deadlocks', 'Memory Management & Paging', 'Virtual Memory', 'Threads & Concurrency', 'File Systems & Disk Scheduling', 'System Calls']
  },
  computer_network: {
    slug: 'computer_network',
    name: 'Computer Networks',
    shortName: 'Networks',
    description: 'OSI Model, TCP/IP, Routing Protocols, DNS, HTTP/HTTPS, Subnetting and Network Security.',
    iconName: 'FaNetworkWired',
    badge: 'Networking',
    targetCompanies: 'Cisco, Juniper, Arista, Jio',
    defaultTopics: ['OSI & TCP/IP Models', 'IP Addressing & Subnetting', 'TCP vs UDP Protocols', 'Routing Algorithms', 'Application Layer (HTTP/DNS)', 'Network Security & Firewalls', 'Data Link Layer & Framing']
  },
  logical_reasoning: {
    slug: 'logical_reasoning',
    name: 'Logical Reasoning & Puzzles',
    shortName: 'Reasoning',
    description: 'Blood relations, Syllogisms, Seating arrangement, Series completion, and Classic interview riddles.',
    iconName: 'FaBrain',
    badge: 'Aptitude',
    targetCompanies: 'Deloitte, PwC, EY, KPMG',
    defaultTopics: ['Syllogisms', 'Blood Relations', 'Seating Arrangements', 'Direction Sense', 'Coding-Decoding', 'Number & Alphabet Series', 'Analytical Puzzles', 'Critical Reasoning']
  },
  verbal_ability: {
    slug: 'verbal_ability',
    name: 'Verbal Ability & English',
    shortName: 'English',
    description: 'Reading Comprehension, Sentence Correction, Vocabulary, Para Jumbles and Grammar.',
    iconName: 'FaFont',
    badge: 'Communication',
    targetCompanies: 'Cognizant, Capgemini, Tech Mahindra',
    defaultTopics: ['Reading Comprehension', 'Sentence Correction & Grammar', 'Vocabulary (Synonyms/Antonyms)', 'Para Jumbles', 'Error Spotting', 'Idioms & Phrases', 'Sentence Completion']
  },
  hr_behavioral: {
    slug: 'hr_behavioral',
    name: 'HR & Behavioral',
    shortName: 'HR & Behavioral',
    description: 'STAR method practice, situational questions, project defense and communication rubric.',
    iconName: 'FaComments',
    badge: 'Interview Simulation',
    targetCompanies: 'All Tech & Product Companies',
    defaultTopics: ['STAR Method Behavioral', 'Leadership & Teamwork', 'Conflict Resolution', 'Strengths & Weaknesses', 'Career Goals & Motivation', 'Stress & Pressure Handling', 'Company Specific Questions']
  }
};

export const SUBJECT_LIST = Object.values(SUBJECTS);

/**
 * Normalizes any category/subject string input to standard database slug
 */
export function normalizeSubjectSlug(input?: string | null): string {
  if (!input) return 'quantitative_aptitude';
  const raw = input.toLowerCase().trim().replace(/[-\s]+/g, '_');

  if (raw === 'aptitude' || raw.includes('quant') || raw === 'quantitative_aptitude') {
    return 'quantitative_aptitude';
  }
  if (raw === 'dsa' || raw.includes('data_structure') || raw.includes('algorithm')) {
    return 'dsa';
  }
  if (raw === 'dbms' || raw.includes('database') || raw.includes('sql')) {
    return 'dbms';
  }
  if (raw === 'os' || raw.includes('operating_system') || raw === 'operating_systems') {
    return 'operating_system';
  }
  if (raw === 'cn' || raw.includes('network') || raw.includes('computer_network') || raw === 'computer_networks') {
    return 'computer_network';
  }
  if (raw === 'reasoning' || raw.includes('logical') || raw.includes('puzzle') || raw === 'logical_reasoning') {
    return 'logical_reasoning';
  }
  if (raw === 'english' || raw.includes('verbal') || raw === 'verbal_ability') {
    return 'verbal_ability';
  }
  if (raw === 'hr' || raw.includes('behavioral') || raw.includes('interview') || raw === 'hr_behavioral') {
    return 'hr_behavioral';
  }

  // Fallback direct check
  if (SUBJECTS[raw]) return raw;

  return 'quantitative_aptitude';
}
