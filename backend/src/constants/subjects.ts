export interface TopicTaxonomy {
  name: string;
  description: string;
  iconName: string;
  aliases?: string[];
  subtopics?: string[];
}

export interface SubjectConfig {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  iconName: string;
  badge: string;
  targetCompanies: string;
  supportsCoding?: boolean;
  defaultTopics: string[];
  topics: TopicTaxonomy[];
}

export const SUBJECTS: Record<string, SubjectConfig> = {
  quantitative_aptitude: {
    slug: 'quantitative_aptitude',
    name: 'Quantitative Aptitude',
    shortName: 'Aptitude',
    description: 'Percentages, Profit & Loss, Time & Work, Speed & Distance, and Probability.',
    iconName: 'FaCalculator',
    badge: 'High Priority',
    targetCompanies: 'TCS, Infosys, Wipro, Accenture',
    supportsCoding: false,
    defaultTopics: [
      'Percentage',
      'Profit and Loss',
      'Time and Work',
      'Time, Speed and Distance',
      'Probability'
    ],
    topics: [
      {
        name: 'Percentage',
        description: 'Percentage calculations, successive changes, and ratio conversions.',
        iconName: 'FaPercent',
        aliases: ['Percentages', 'Percentages & Profit']
      },
      {
        name: 'Profit and Loss',
        description: 'Cost price, selling price, marked price, and discount problems.',
        iconName: 'FaChartLine',
        aliases: ['Profit & Loss']
      },
      {
        name: 'Time and Work',
        description: 'Work efficiency, combined work rates, alternate days, and pipes.',
        iconName: 'FaBriefcase',
        aliases: ['Time & Work', 'Time Work', 'Pipes and Cisterns']
      },
      {
        name: 'Time, Speed and Distance',
        description: 'Relative speed, problems on trains, boats, and average speed.',
        iconName: 'FaGaugeHigh',
        aliases: ['Time and Speed', 'Time Speed Distance', 'Speed, Distance & Time', 'Speed & Distance', 'Trains', 'Boats and Streams', 'Problems on Trains'],
        subtopics: ['Problems on Trains', 'Relative Speed', 'Boats and Streams', 'Average Speed']
      },
      {
        name: 'Probability',
        description: 'Events, conditional probability, dice, cards, and combinations.',
        iconName: 'FaDice',
        aliases: ['Probability']
      }
    ]
  },
  logical_reasoning: {
    slug: 'logical_reasoning',
    name: 'Logical Reasoning',
    shortName: 'Reasoning',
    description: 'Number Series, Coding-Decoding, Blood Relations, Seating Arrangement, and Syllogisms.',
    iconName: 'FaBrain',
    badge: 'Aptitude Core',
    targetCompanies: 'TCS NQT, Capgemini, Cognizant',
    supportsCoding: false,
    defaultTopics: [
      'Number Series',
      'Coding-Decoding',
      'Blood Relations',
      'Seating Arrangement',
      'Syllogisms'
    ],
    topics: [
      {
        name: 'Number Series',
        description: 'Arithmetic, geometric, and mixed pattern number sequences.',
        iconName: 'FaArrowUp19',
        aliases: ['Number & Alphabet Series', 'Series']
      },
      {
        name: 'Coding-Decoding',
        description: 'Letter shifting, symbol substitution, and pattern ciphering.',
        iconName: 'FaKey',
        aliases: ['Coding Decoding']
      },
      {
        name: 'Blood Relations',
        description: 'Family tree deduction, coded relations, and lineage puzzles.',
        iconName: 'FaUsers',
        aliases: ['Blood Relation']
      },
      {
        name: 'Seating Arrangement',
        description: 'Linear, circular, and multi-row positional arrangement puzzles.',
        iconName: 'FaChair',
        aliases: ['Seating Arrangements']
      },
      {
        name: 'Syllogisms',
        description: 'Venn diagram logic, deductive statements, and conclusions.',
        iconName: 'FaDiagramProject',
        aliases: ['Syllogism']
      }
    ]
  },
  verbal_ability: {
    slug: 'verbal_ability',
    name: 'Verbal Ability',
    shortName: 'Verbal',
    description: 'Reading Comprehension, Sentence Correction, Synonyms & Antonyms, Para Jumbles, and Error Detection.',
    iconName: 'FaFont',
    badge: 'Communication',
    targetCompanies: 'Deloitte, Cognizant, Wipro, TCS',
    supportsCoding: false,
    defaultTopics: [
      'Reading Comprehension',
      'Sentence Correction',
      'Synonyms and Antonyms',
      'Para Jumbles',
      'Error Detection'
    ],
    topics: [
      {
        name: 'Reading Comprehension',
        description: 'Passage analysis, inference, main idea, and tone questions.',
        iconName: 'FaBookOpen',
        aliases: ['RC']
      },
      {
        name: 'Sentence Correction',
        description: 'Subject-verb agreement, modifiers, tenses, and parallelism.',
        iconName: 'FaPenNib',
        aliases: ['Grammar & Sentence Correction']
      },
      {
        name: 'Synonyms and Antonyms',
        description: 'Contextual word meanings, synonyms, antonyms, and analogies.',
        iconName: 'FaSpellCheck',
        aliases: ['Vocabulary (Synonyms/Antonyms)', 'Vocabulary', 'Synonyms & Antonyms']
      },
      {
        name: 'Para Jumbles',
        description: 'Coherent paragraph ordering and logical sentence flow.',
        iconName: 'FaListOl',
        aliases: ['Parajumbles']
      },
      {
        name: 'Error Detection',
        description: 'Identifying grammatical, preposition, and usage errors.',
        iconName: 'FaMagnifyingGlass',
        aliases: ['Spotting Errors']
      }
    ]
  },
  dsa: {
    slug: 'dsa',
    name: 'Data Structures and Algorithms',
    shortName: 'DSA',
    description: 'Arrays & Strings, Linked Lists, Stacks & Queues, Trees & BST, and Sorting & Searching.',
    iconName: 'FaCode',
    badge: 'Technical Core',
    targetCompanies: 'Amazon, Google, Microsoft, Flipkart',
    supportsCoding: true,
    defaultTopics: [
      'Arrays and Strings',
      'Linked Lists',
      'Stacks and Queues',
      'Trees and Binary Search Trees',
      'Sorting and Searching'
    ],
    topics: [
      {
        name: 'Arrays and Strings',
        description: 'Two pointers, sliding window, prefix sums, and string manipulation.',
        iconName: 'FaLayerGroup',
        aliases: ['Arrays', 'Strings', 'Arrays & Strings']
      },
      {
        name: 'Linked Lists',
        description: 'Singly/doubly linked lists, cycle detection, and reversal.',
        iconName: 'FaLink',
        aliases: ['Linked List']
      },
      {
        name: 'Stacks and Queues',
        description: 'Monotonic stacks, expression parsing, and circular queues.',
        iconName: 'FaBarsStaggered',
        aliases: ['Stacks & Queues', 'Stack and Queue']
      },
      {
        name: 'Trees and Binary Search Trees',
        description: 'Traversals, height, LCA, BST validation, and balanced trees.',
        iconName: 'FaSitemap',
        aliases: ['Trees & BST', 'Trees', 'Binary Search Trees', 'Trees and BST']
      },
      {
        name: 'Sorting and Searching',
        description: 'Binary search variants, quicksort, mergesort, and time bounds.',
        iconName: 'FaArrowDownShortWide',
        aliases: ['Sorting & Searching', 'Binary Search', 'Sorting']
      }
    ]
  },
  programming: {
    slug: 'programming',
    name: 'Programming',
    shortName: 'Programming',
    description: 'Core syntax, memory behavior, and idioms across Python, Java, C, C++, and JavaScript.',
    iconName: 'FaTerminal',
    badge: 'Language Mastery',
    targetCompanies: 'TCS Digital, Zoho, Infosys SP, Amazon',
    supportsCoding: true,
    defaultTopics: [
      'Python',
      'Java',
      'C',
      'C++',
      'JavaScript'
    ],
    topics: [
      {
        name: 'Python',
        description: 'Data types, list comprehensions, decorators, and Pythonic idioms.',
        iconName: 'FaPython',
        aliases: ['Python Programming']
      },
      {
        name: 'Java',
        description: 'JVM internals, collections framework, streams, and exceptions.',
        iconName: 'FaJava',
        aliases: ['Java Programming']
      },
      {
        name: 'C',
        description: 'Pointers, memory layout, structs, and preprocessor behavior.',
        iconName: 'FaTerminal',
        aliases: ['C Programming', 'C Language']
      },
      {
        name: 'C++',
        description: 'STL containers, references, templates, and smart pointers.',
        iconName: 'FaCode',
        aliases: ['CPP', 'C++ Programming']
      },
      {
        name: 'JavaScript',
        description: 'Closures, event loop, promises, prototypes, and ES6+.',
        iconName: 'FaJs',
        aliases: ['JS']
      }
    ]
  },
  dbms: {
    slug: 'dbms',
    name: 'Database Management Systems',
    shortName: 'DBMS',
    description: 'SQL Queries, Normalization, Joins, Transactions & ACID, and Indexing.',
    iconName: 'FaDatabase',
    badge: 'CS Core',
    targetCompanies: 'Oracle, SAP, Cisco, Goldman Sachs',
    supportsCoding: false,
    defaultTopics: [
      'SQL Queries',
      'Normalization',
      'Joins',
      'Transactions and ACID',
      'Indexing'
    ],
    topics: [
      {
        name: 'SQL Queries',
        description: 'SELECT, GROUP BY, HAVING, aggregate functions, and subqueries.',
        iconName: 'FaDatabase',
        aliases: ['SQL']
      },
      {
        name: 'Normalization',
        description: 'Functional dependencies, 1NF, 2NF, 3NF, and BCNF.',
        iconName: 'FaTableColumns',
        aliases: ['Normalization (1NF-BCNF)']
      },
      {
        name: 'Joins',
        description: 'INNER, LEFT, RIGHT, FULL OUTER, and self joins.',
        iconName: 'FaCodeMerge',
        aliases: ['Joins & Subqueries', 'SQL Joins']
      },
      {
        name: 'Transactions and ACID',
        description: 'Atomicity, consistency, isolation levels, and serializability.',
        iconName: 'FaShieldHalved',
        aliases: ['Transactions & ACID', 'ACID Properties', 'Transactions']
      },
      {
        name: 'Indexing',
        description: 'B+ trees, clustered vs non-clustered indexes, and query speed.',
        iconName: 'FaBolt',
        aliases: ['Indexing & B-Trees', 'B-Trees']
      }
    ]
  },
  operating_system: {
    slug: 'operating_system',
    name: 'Operating Systems',
    shortName: 'OS',
    description: 'Process Management, CPU Scheduling, Memory Management, Deadlocks, and Synchronization.',
    iconName: 'FaServer',
    badge: 'CS Core',
    targetCompanies: 'Microsoft, Qualcomm, Nvidia, Adobe',
    supportsCoding: false,
    defaultTopics: [
      'Process Management',
      'CPU Scheduling',
      'Memory Management',
      'Deadlocks',
      'Synchronization'
    ],
    topics: [
      {
        name: 'Process Management',
        description: 'Process states, PCB, context switching, and threads.',
        iconName: 'FaMicrochip',
        aliases: ['Processes and Threads']
      },
      {
        name: 'CPU Scheduling',
        description: 'FCFS, SJF, Round Robin, priority scheduling, and turnaround.',
        iconName: 'FaClock',
        aliases: ['Scheduling Algorithms']
      },
      {
        name: 'Memory Management',
        description: 'Paging, segmentation, TLB, page replacement, and thrashing.',
        iconName: 'FaMemory',
        aliases: ['Memory Management & Paging', 'Virtual Memory']
      },
      {
        name: 'Deadlocks',
        description: 'Coffman conditions, Banker’s algorithm, and deadlock recovery.',
        iconName: 'FaLock',
        aliases: ['Deadlock']
      },
      {
        name: 'Synchronization',
        description: 'Mutexes, semaphores, critical section, and race conditions.',
        iconName: 'FaArrowsRotate',
        aliases: ['Process Synchronization']
      }
    ]
  },
  computer_network: {
    slug: 'computer_network',
    name: 'Computer Networks',
    shortName: 'Networks',
    description: 'OSI & TCP/IP Models, Network Protocols, IP Addressing, TCP vs UDP, and Routing & Switching.',
    iconName: 'FaNetworkWired',
    badge: 'CS Core',
    targetCompanies: 'Cisco, Juniper, Arista, Amazon',
    supportsCoding: false,
    defaultTopics: [
      'OSI and TCP/IP Models',
      'Network Protocols',
      'IP Addressing',
      'TCP vs UDP',
      'Routing and Switching'
    ],
    topics: [
      {
        name: 'OSI and TCP/IP Models',
        description: '7-layer OSI architecture, encapsulation, and TCP/IP stack.',
        iconName: 'FaLayerGroup',
        aliases: ['OSI & TCP/IP Models', 'OSI Model']
      },
      {
        name: 'Network Protocols',
        description: 'HTTP/HTTPS, DNS, DHCP, ARP, ICMP, and application protocols.',
        iconName: 'FaGlobe',
        aliases: ['HTTP DNS ARP']
      },
      {
        name: 'IP Addressing',
        description: 'IPv4/IPv6, CIDR notation, subnet masks, and NAT.',
        iconName: 'FaNetworkWired',
        aliases: ['IP Addressing & Subnetting', 'Subnetting']
      },
      {
        name: 'TCP vs UDP',
        description: '3-way handshake, flow/congestion control, and UDP datagrams.',
        iconName: 'FaRightLeft',
        aliases: ['TCP vs UDP Protocols']
      },
      {
        name: 'Routing and Switching',
        description: 'MAC tables, distance vector, link state, and OSPF/BGP.',
        iconName: 'FaRoute',
        aliases: ['Routing']
      }
    ]
  },
  oops: {
    slug: 'oops',
    name: 'Object-Oriented Programming',
    shortName: 'OOP',
    description: 'Encapsulation, Inheritance, Polymorphism, Abstraction, and Constructors & Methods.',
    iconName: 'FaCubes',
    badge: 'Design Core',
    targetCompanies: 'Zoho, Amazon, Microsoft, Atlassian',
    supportsCoding: true,
    defaultTopics: [
      'Encapsulation',
      'Inheritance',
      'Polymorphism',
      'Abstraction',
      'Constructors and Methods'
    ],
    topics: [
      {
        name: 'Encapsulation',
        description: 'Data hiding, access modifiers, and getters/setters.',
        iconName: 'FaBoxArchive',
        aliases: []
      },
      {
        name: 'Inheritance',
        description: 'Single, multilevel, hierarchical inheritance, and base/super.',
        iconName: 'FaSitemap',
        aliases: []
      },
      {
        name: 'Polymorphism',
        description: 'Method overloading, overriding, virtual dispatch, and binding.',
        iconName: 'FaShapes',
        aliases: []
      },
      {
        name: 'Abstraction',
        description: 'Abstract classes, interfaces, and implementation hiding.',
        iconName: 'FaEyeSlash',
        aliases: []
      },
      {
        name: 'Constructors and Methods',
        description: 'Default/copy constructors, destructors, static, and final.',
        iconName: 'FaWrench',
        aliases: ['Constructors']
      }
    ]
  },
  web_development: {
    slug: 'web_development',
    name: 'Web Development',
    shortName: 'Web Dev',
    description: 'HTML & CSS, JavaScript Fundamentals, React, Node.js, and REST APIs.',
    iconName: 'FaLaptopCode',
    badge: 'Full Stack',
    targetCompanies: 'Flipkart, Swiggy, Razorpay, Startups',
    supportsCoding: true,
    defaultTopics: [
      'HTML and CSS',
      'JavaScript Fundamentals',
      'React',
      'Node.js',
      'REST APIs'
    ],
    topics: [
      {
        name: 'HTML and CSS',
        description: 'Semantic HTML, Flexbox, Grid, specificity, and responsive design.',
        iconName: 'FaHtml5',
        aliases: ['HTML & CSS']
      },
      {
        name: 'JavaScript Fundamentals',
        description: 'DOM manipulation, fetch API, closures, and async/await.',
        iconName: 'FaJs',
        aliases: ['DOM & Async JS']
      },
      {
        name: 'React',
        description: 'Hooks, virtual DOM, state management, and component lifecycle.',
        iconName: 'FaReact',
        aliases: ['React.js']
      },
      {
        name: 'Node.js',
        description: 'Event-driven I/O, Express middleware, streams, and npm.',
        iconName: 'FaNodeJs',
        aliases: ['Node']
      },
      {
        name: 'REST APIs',
        description: 'HTTP methods, status codes, statelessness, and JSON payloads.',
        iconName: 'FaServer',
        aliases: ['REST']
      }
    ]
  },
  hr_behavioral: {
    slug: 'hr_behavioral',
    name: 'HR & Behavioral',
    shortName: 'HR & Behavioral',
    description: 'STAR method practice, leadership, conflict resolution, and communication rubric.',
    iconName: 'FaComments',
    badge: 'Interview Simulation',
    targetCompanies: 'All Tech & Product Companies',
    supportsCoding: false,
    defaultTopics: [
      'STAR Method Behavioral',
      'Leadership & Teamwork',
      'Conflict Resolution',
      'Strengths & Weaknesses',
      'Career Goals & Motivation'
    ],
    topics: [
      {
        name: 'STAR Method Behavioral',
        description: 'Structuring Situation, Task, Action, and Result answers.',
        iconName: 'FaStar',
        aliases: []
      },
      {
        name: 'Leadership & Teamwork',
        description: 'Ownership, collaboration, mentoring, and deadline handling.',
        iconName: 'FaUsers',
        aliases: []
      },
      {
        name: 'Conflict Resolution',
        description: 'Resolving technical disagreements and team friction constructively.',
        iconName: 'FaHandshake',
        aliases: []
      },
      {
        name: 'Strengths & Weaknesses',
        description: 'Self-awareness, growth mindset, and constructive framing.',
        iconName: 'FaScaleBalanced',
        aliases: []
      },
      {
        name: 'Career Goals & Motivation',
        description: 'Company alignment, role motivation, and 5-year vision.',
        iconName: 'FaCompass',
        aliases: []
      }
    ]
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
  if (raw === 'programming' || raw === 'coding_languages') {
    return 'programming';
  }
  if (raw === 'oops' || raw === 'oop' || raw.includes('object_oriented')) {
    return 'oops';
  }
  if (raw === 'web_development' || raw === 'web_dev' || raw === 'web') {
    return 'web_development';
  }
  if (raw === 'dbms' || raw.includes('database') || raw === 'sql') {
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

  if (SUBJECTS[raw]) return raw;
  return 'quantitative_aptitude';
}

/**
 * Retrieve the Top 5 Common Topics for a subject
 */
export function getTopicsForSubject(subjectSlug?: string): string[] {
  const slug = normalizeSubjectSlug(subjectSlug);
  const cfg = SUBJECTS[slug];
  if (!cfg) return [];
  return cfg.topics.slice(0, 5).map(t => t.name);
}

/**
 * Retrieve full Top 5 Topic objects (name, description, iconName) for a subject
 */
export function getTopicObjectsForSubject(subjectSlug?: string): TopicTaxonomy[] {
  const slug = normalizeSubjectSlug(subjectSlug);
  const cfg = SUBJECTS[slug];
  if (!cfg) return [];
  return cfg.topics.slice(0, 5);
}

/**
 * Legacy helper kept for backward compatibility with Battle Arena if referenced
 */
export function getSubtopicsForTopic(subjectSlug: string, topicName: string): string[] {
  const slug = normalizeSubjectSlug(subjectSlug);
  const cfg = SUBJECTS[slug];
  if (!cfg || !cfg.topics) return [];
  const found = cfg.topics.find(t => isTopicMatch(t.name, topicName));
  return found ? (found.subtopics || []) : [];
}

/**
 * Clean token while preserving '+' so 'C++' does not collide with 'C'
 */
function cleanTopicToken(str: string): string {
  return str.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9+]/g, '');
}

/**
 * Strict, non-bleeding topic matching supporting exact canonical names and explicit taxonomy aliases.
 * Never performs loose substring matching across unrelated topics (e.g. 'C' vs 'C++' or 'Time and Work' vs 'Time and Speed').
 */
export function isTopicMatch(candidateTopic?: string | null, targetTopic?: string | null): boolean {
  if (!candidateTopic || !targetTopic) return false;
  const c = candidateTopic.trim().toLowerCase();
  const t = targetTopic.trim().toLowerCase();

  if (c === t) return true;
  if (t === 'all' || t === 'all topics') return true;

  const cleanC = cleanTopicToken(c);
  const cleanT = cleanTopicToken(t);
  if (cleanC === cleanT) return true;

  // Check explicit taxonomy aliases across subjects
  for (const sub of Object.values(SUBJECTS)) {
    for (const top of sub.topics || []) {
      const topClean = cleanTopicToken(top.name);
      const aliasCleans = (top.aliases || []).map(a => cleanTopicToken(a));
      const allVariants = [topClean, ...aliasCleans];
      if (allVariants.includes(cleanT) && allVariants.includes(cleanC)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Legacy subtopic matcher kept for Battle Arena backward compatibility
 */
export function isSubtopicMatch(candidateSubtopic?: string | null, targetSubtopic?: string | null): boolean {
  if (!candidateSubtopic || !targetSubtopic) return false;
  const c = candidateSubtopic.trim().toLowerCase();
  const t = targetSubtopic.trim().toLowerCase();
  if (c === t) return true;
  if (t === 'all' || t === 'all subtopics') return true;
  const cleanC = cleanTopicToken(c);
  const cleanT = cleanTopicToken(t);
  if (cleanC === cleanT) return true;
  if (cleanT.includes('train') && cleanC.includes('train')) return true;
  return cleanC.includes(cleanT) || cleanT.includes(cleanC);
}
