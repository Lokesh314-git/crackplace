export interface TopicTaxonomy {
  name: string;
  subtopics: string[];
  aliases?: string[];
}

export interface SubjectConfig {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  iconName: string;
  badge: string;
  targetCompanies: string;
  defaultTopics: string[];
  topics: TopicTaxonomy[];
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
    defaultTopics: [
      'Time and Speed',
      'Percentages',
      'Profit and Loss',
      'Time and Work',
      'Simple Interest',
      'Compound Interest',
      'Ratio and Proportion',
      'Averages',
      'Problems on Ages',
      'Number System',
      'LCM and HCF',
      'Pipes and Cisterns',
      'Probability',
      'Permutations and Combinations',
      'Mixtures and Allegations',
      'Partnership',
      'Clocks',
      'Calendars',
      'Mensuration',
      'Geometry'
    ],
    topics: [
      {
        name: 'Time and Speed',
        aliases: ['Time Speed Distance', 'Speed, Distance & Time', 'Speed & Distance', 'Time, Speed and Distance', 'Trains', 'Boats and Streams'],
        subtopics: [
          'Problems on Trains',
          'Relative Speed',
          'Platform Crossing',
          'Average Speed',
          'Opposite Direction Crossing',
          'Passing a Pole',
          'Parallel Tracks Same Direction',
          'Boats and Streams',
          'Races',
          'Stoppages'
        ]
      },
      {
        name: 'Percentages',
        aliases: ['Percentage', 'Percentages & Profit'],
        subtopics: [
          'Basic Percentage',
          'Price and Consumption',
          'Successive Percentage',
          'Population Growth',
          'Election Problems',
          'Income and Expenditure'
        ]
      },
      {
        name: 'Profit and Loss',
        aliases: ['Profit & Loss'],
        subtopics: [
          'Cost and Selling Price',
          'Faulty Balances',
          'Successive Discounts',
          'Marked Price and Discount',
          'Equal Cost and Selling',
          'Identical Selling Price'
        ]
      },
      {
        name: 'Time and Work',
        aliases: ['Time & Work', 'Time Work'],
        subtopics: [
          'Combined Work',
          'Alternate Days',
          'Efficiency Ratio',
          'Wages Distribution',
          'Pipes and Cisterns'
        ]
      },
      {
        name: 'Simple Interest',
        aliases: ['Simple & Compound Interest'],
        subtopics: [
          'Rate Calculation',
          'Installments',
          'Sum of Amounts',
          'Principal Calculation',
          'Time Calculation'
        ]
      },
      {
        name: 'Compound Interest',
        subtopics: [
          'Annual Compounding',
          'Half-Yearly Compounding',
          'Difference SI and CI',
          'Compounding Frequency',
          'Doubling Period'
        ]
      },
      {
        name: 'Ratio and Proportion',
        aliases: ['Ratio & Proportion'],
        subtopics: [
          'Mean Proportional',
          'Direct and Inverse Variation',
          'Coin Problems',
          'Third and Fourth Proportional',
          'Salaries'
        ]
      },
      {
        name: 'Averages',
        subtopics: [
          'Arithmetic Mean',
          'Replacement Problems',
          'Cricket Batting Average',
          'Speed and Harmonic Mean',
          'Age of Group'
        ]
      },
      {
        name: 'Problems on Ages',
        subtopics: [
          'Linear Equations',
          'Simultaneous Equations',
          'Ratio Variations',
          'Difference of Ages',
          'Product of Ages'
        ]
      },
      {
        name: 'Number System',
        aliases: ['Number Systems'],
        subtopics: [
          'Divisibility Rules',
          'Remainders',
          'Unit Digit',
          'Trailing Zeroes',
          'Factors and Multiples'
        ]
      },
      {
        name: 'LCM and HCF',
        aliases: ['LCM & HCF'],
        subtopics: [
          'Word Problems',
          'Remainders',
          'Product Formula',
          'Fractions',
          'Smallest Multiple'
        ]
      },
      {
        name: 'Pipes and Cisterns',
        subtopics: [
          'Combined Filling',
          'Filling and Emptying',
          'Leakage Problems',
          'Two Inlets One Outlet',
          'Three Inlets'
        ]
      },
      {
        name: 'Probability',
        subtopics: [
          'Playing Cards',
          'Independent Events',
          'Dice Sums',
          'Balls in an Urn',
          'Tossing Coins'
        ]
      },
      {
        name: 'Permutations and Combinations',
        aliases: ['Permutation & Combination'],
        subtopics: [
          'Arrangements with Restrictions',
          'Committee Selection',
          'Circular Permutation',
          'Handshakes',
          'Digit Formation'
        ]
      },
      {
        name: 'Mixtures and Allegations',
        aliases: ['Mixtures & Alligations'],
        subtopics: [
          'Replacement Rule',
          'Two Solutions',
          'Cost Price Alligation',
          'Concentration Change',
          'Milk and Water Ratio'
        ]
      },
      {
        name: 'Partnership',
        subtopics: [
          'Profit Sharing Ratio',
          'Unequal Periods',
          'Active Partner Salary',
          'Capital Change'
        ]
      },
      {
        name: 'Clocks',
        subtopics: [
          'Angle Between Hands',
          'Overlapping Hands',
          'Right Angles',
          'Minute Hand Speed'
        ]
      },
      {
        name: 'Calendars',
        subtopics: [
          'Odd Days',
          'Century Leap Year',
          'Same Calendar Year',
          'Finding Day of Week'
        ]
      },
      {
        name: 'Mensuration',
        subtopics: [
          'Cylinders and Cones',
          'Sphere Surface Area',
          'Trapezium',
          'Cylinder Volume'
        ]
      },
      {
        name: 'Geometry',
        subtopics: [
          'Circles and Tangents',
          'Triangles and Angles',
          'Right Triangles',
          'Polygons'
        ]
      }
    ]
  },
  dsa: {
    slug: 'dsa',
    name: 'Data Structures & Algorithms',
    shortName: 'DSA',
    description: 'Arrays, Strings, Linked Lists, Trees, Graphs, Dynamic Programming, Heaps, and Recursion.',
    iconName: 'FaCode',
    badge: 'Core Technical',
    targetCompanies: 'Amazon, Microsoft, Google, Adobe',
    defaultTopics: [
      'Arrays',
      'Strings',
      'Linked Lists',
      'Stacks & Queues',
      'Trees & BST',
      'Graphs',
      'Dynamic Programming',
      'Sorting & Searching',
      'Heaps & Hashing',
      'Recursion & Backtracking',
      'Bit Manipulation'
    ],
    topics: [
      {
        name: 'Arrays',
        subtopics: [
          'Array Traversal',
          'Two Pointers',
          'Prefix Sum',
          "Kadane's Algorithm",
          'Insertion',
          'Sliding Window'
        ]
      },
      {
        name: 'Strings',
        subtopics: [
          'Palindrome',
          'Anagrams',
          'Pattern Matching',
          'Rabin-Karp',
          'String Compression'
        ]
      },
      {
        name: 'Linked Lists',
        subtopics: [
          'Singly Linked List',
          'Cycle Detection',
          'Reversal',
          'Middle Node',
          'Doubly Linked List'
        ]
      },
      {
        name: 'Stacks & Queues',
        aliases: ['Stacks', 'Queues and Deques', 'Stacks and Queues'],
        subtopics: [
          'Stack Operations',
          'Balanced Parentheses',
          'Monotonic Stack',
          'Queue using Stacks',
          'Circular Queue',
          'Deque'
        ]
      },
      {
        name: 'Trees & BST',
        aliases: ['Trees', 'Binary Search Trees', 'Trees and BST'],
        subtopics: [
          'Binary Trees',
          'Tree Traversal',
          'BST Properties',
          'Height',
          'AVL Trees',
          'Deletion'
        ]
      },
      {
        name: 'Graphs',
        aliases: ['Shortest Path Algorithms', 'Minimum Spanning Tree', 'Disjoint Set Union'],
        subtopics: [
          'BFS',
          'DFS',
          'Graph Terminology',
          'Topological Sorting',
          'Bipartite Graphs',
          'Dijkstra',
          'Kruskal',
          'Union-Find / DSU'
        ]
      },
      {
        name: 'Dynamic Programming',
        subtopics: [
          '0/1 Knapsack',
          'Longest Common Subsequence',
          'Coin Change',
          'Overlapping Subproblems',
          'Edit Distance'
        ]
      },
      {
        name: 'Sorting & Searching',
        aliases: ['Searching', 'Sorting', 'Sorting and Searching'],
        subtopics: [
          'Binary Search',
          'Merge Sort',
          'Quick Sort',
          'Search in Rotated Array',
          'Bubble Sort',
          'Counting Sort'
        ]
      },
      {
        name: 'Heaps & Hashing',
        aliases: ['Heaps and Priority Queues', 'Hashing', 'Heaps and Hash Tables'],
        subtopics: [
          'Min Heap',
          'Heap Insertion',
          'Hash Collision',
          'Two-sum Problems',
          'Top K Problems'
        ]
      },
      {
        name: 'Recursion & Backtracking',
        aliases: ['Recursion', 'Backtracking'],
        subtopics: [
          'Base Cases',
          'Tail Recursion',
          'N-Queens',
          'Subsets',
          'Sudoku'
        ]
      },
      {
        name: 'Bit Manipulation',
        subtopics: [
          'Set Bit',
          'Power of Two',
          'Count Set Bits',
          'XOR Properties',
          'Toggle Bit'
        ]
      }
    ]
  },
  dbms: {
    slug: 'dbms',
    name: 'Database Management Systems',
    shortName: 'DBMS',
    description: 'SQL queries, Normalization, ACID properties, Indexing, Transactions, and ER modeling.',
    iconName: 'FaDatabase',
    badge: 'CS Core',
    targetCompanies: 'Oracle, Cisco, Morgan Stanley',
    defaultTopics: [
      'SQL Queries',
      'Joins & Subqueries',
      'Transactions & ACID',
      'Normalization (1NF-BCNF)',
      'Indexing & B-Trees',
      'Concurrency Control'
    ],
    topics: [
      {
        name: 'SQL Queries',
        subtopics: ['SELECT & WHERE', 'GROUP BY & HAVING', 'Aggregate Functions', 'Subqueries']
      },
      {
        name: 'Joins & Subqueries',
        aliases: ['Joins'],
        subtopics: ['INNER JOIN', 'LEFT OUTER JOIN', 'CROSS JOIN', 'Correlated Subqueries', 'Self Join']
      },
      {
        name: 'Transactions & ACID',
        aliases: ['Transactions'],
        subtopics: ['Atomicity', 'Consistency', 'Isolation Levels', 'Durability', 'Write-Ahead Logging']
      },
      {
        name: 'Normalization (1NF-BCNF)',
        aliases: ['Normalization'],
        subtopics: ['First Normal Form (1NF)', 'Second Normal Form (2NF)', 'Third Normal Form (3NF)', 'BCNF']
      },
      {
        name: 'Indexing & B-Trees',
        aliases: ['Indexing'],
        subtopics: ['B+ Trees', 'Clustered vs Non-clustered', 'Hash Indexing', 'Query Optimization']
      },
      {
        name: 'Concurrency Control',
        subtopics: ['Two-Phase Locking (2PL)', 'Deadlock Handling', 'Timestamp Ordering', 'Lock Modes']
      }
    ]
  },
  operating_system: {
    slug: 'operating_system',
    name: 'Operating Systems',
    shortName: 'OS',
    description: 'Process synchronization, Deadlocks, Memory Management, Paging, CPU Scheduling & Threads.',
    iconName: 'FaServer',
    badge: 'CS Core',
    targetCompanies: 'Qualcomm, Intel, Samsung, Cisco',
    defaultTopics: [
      'CPU Scheduling',
      'Process Synchronization',
      'Deadlocks',
      'Memory Management & Paging',
      'Threads & Concurrency',
      'File Systems & System Calls'
    ],
    topics: [
      {
        name: 'CPU Scheduling',
        subtopics: ['FCFS', 'Round Robin', 'Shortest Job First (SJF)', 'Priority Scheduling', 'Aging']
      },
      {
        name: 'Process Synchronization',
        subtopics: ['Critical Section', 'Semaphores', 'Mutex Locks', 'Peterson\'s Solution', 'Spinlocks']
      },
      {
        name: 'Deadlocks',
        subtopics: ['Coffman Conditions', 'Banker\'s Algorithm', 'Deadlock Prevention', 'Resource Allocation Graph']
      },
      {
        name: 'Memory Management & Paging',
        aliases: ['Memory Management', 'Paging'],
        subtopics: ['Paging & Segmentation', 'Virtual Memory', 'TLB', 'Page Replacement (FIFO/LRU)', 'Thrashing']
      },
      {
        name: 'Threads & Concurrency',
        subtopics: ['User vs Kernel Threads', 'Race Conditions', 'Thread Pools', 'Multithreading Models']
      },
      {
        name: 'File Systems & System Calls',
        subtopics: ['File Allocation Methods', 'Inodes', 'fork() and exec()', 'I/O Management']
      }
    ]
  },
  computer_network: {
    slug: 'computer_network',
    name: 'Computer Networks',
    shortName: 'Networks',
    description: 'OSI Model, TCP/IP, Routing Protocols, DNS, HTTP/HTTPS, Subnetting and Network Security.',
    iconName: 'FaNetworkWired',
    badge: 'Networking',
    targetCompanies: 'Cisco, Juniper, Arista, Jio',
    defaultTopics: [
      'OSI & TCP/IP Models',
      'IP Addressing & Subnetting',
      'TCP vs UDP Protocols',
      'Routing Algorithms',
      'Application Layer (HTTP/DNS)',
      'Network Security & Firewalls'
    ],
    topics: [
      {
        name: 'OSI & TCP/IP Models',
        subtopics: ['7 Layers Architecture', 'Encapsulation', 'Layer Responsibilities', 'Protocol Data Units']
      },
      {
        name: 'IP Addressing & Subnetting',
        subtopics: ['IPv4 Classes', 'CIDR Notation', 'Subnet Mask Calculation', 'IPv6 Basics', 'Private vs Public IP']
      },
      {
        name: 'TCP vs UDP Protocols',
        subtopics: ['3-Way Handshake', 'Flow Control & Congestion Control', 'Reliability vs Speed', 'UDP Datagrams']
      },
      {
        name: 'Routing Algorithms',
        subtopics: ['Dijkstra / OSPF', 'Distance Vector / RIP', 'BGP', 'Link-State Routing']
      },
      {
        name: 'Application Layer (HTTP/DNS)',
        subtopics: ['DNS Resolution', 'HTTP vs HTTPS', 'Cookies & Headers', 'SMTP/FTP']
      },
      {
        name: 'Network Security & Firewalls',
        subtopics: ['Packet Filtering', 'NAT', 'SSL/TLS Handshake', 'DDoS Attacks']
      }
    ]
  },
  logical_reasoning: {
    slug: 'logical_reasoning',
    name: 'Logical Reasoning & Puzzles',
    shortName: 'Reasoning',
    description: 'Blood relations, Syllogisms, Seating arrangement, Series completion, and Classic interview riddles.',
    iconName: 'FaBrain',
    badge: 'Aptitude',
    targetCompanies: 'Deloitte, PwC, EY, KPMG',
    defaultTopics: [
      'Blood Relations',
      'Number & Alphabet Series',
      'Direction Sense',
      'Syllogisms',
      'Coding-Decoding',
      'Seating Arrangements'
    ],
    topics: [
      {
        name: 'Blood Relations',
        subtopics: ['Family Tree Analysis', 'Coded Blood Relations', 'Direct Identification']
      },
      {
        name: 'Number & Alphabet Series',
        subtopics: ['Difference Patterns', 'Geometric Patterns', 'Alternating Series', 'Letter Shifting']
      },
      {
        name: 'Direction Sense',
        subtopics: ['Cardinal Directions', 'Turn & Angle Changes', 'Displacement Calculation', 'Shadow Problems']
      },
      {
        name: 'Syllogisms',
        subtopics: ['Venn Diagram Method', 'Possibility Cases', 'Negative Statements']
      },
      {
        name: 'Coding-Decoding',
        subtopics: ['Letter Shifting', 'Number Coding', 'Substitution Coding']
      },
      {
        name: 'Seating Arrangements',
        subtopics: ['Linear Arrangement', 'Circular Arrangement', 'Facing Center/Outside']
      }
    ]
  },
  verbal_ability: {
    slug: 'verbal_ability',
    name: 'Verbal Ability & English',
    shortName: 'English',
    description: 'Reading Comprehension, Sentence Correction, Vocabulary, Para Jumbles and Grammar.',
    iconName: 'FaFont',
    badge: 'Communication',
    targetCompanies: 'Cognizant, Capgemini, Tech Mahindra',
    defaultTopics: [
      'Sentence Correction & Grammar',
      'Vocabulary (Synonyms/Antonyms)',
      'Reading Comprehension',
      'Para Jumbles',
      'Error Spotting',
      'Idioms & Phrases'
    ],
    topics: [
      {
        name: 'Sentence Correction & Grammar',
        aliases: ['Grammar', 'Sentence Correction'],
        subtopics: ['Subject-Verb Agreement', 'Tense Consistency', 'Modifiers & Parallelism', 'Articles & Prepositions']
      },
      {
        name: 'Vocabulary (Synonyms/Antonyms)',
        aliases: ['Vocabulary'],
        subtopics: ['Synonyms', 'Antonyms', 'Contextual Word Meanings']
      },
      {
        name: 'Reading Comprehension',
        subtopics: ['Main Idea & Tone', 'Inference Questions', 'Fact Verification']
      },
      {
        name: 'Para Jumbles',
        subtopics: ['Opening Sentences', 'Mandatory Pairs', 'Logical Sequencing']
      },
      {
        name: 'Error Spotting',
        subtopics: ['Grammatical Errors', 'Punctuation Errors', 'Idiomatic Usage']
      },
      {
        name: 'Idioms & Phrases',
        subtopics: ['Common Idioms', 'Phrasal Verbs', 'Proverbs']
      }
    ]
  },
  hr_behavioral: {
    slug: 'hr_behavioral',
    name: 'HR & Behavioral',
    shortName: 'HR & Behavioral',
    description: 'STAR method practice, situational questions, project defense and communication rubric.',
    iconName: 'FaComments',
    badge: 'Interview Simulation',
    targetCompanies: 'All Tech & Product Companies',
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
        subtopics: ['Situation & Task Definition', 'Action Detail', 'Measurable Results']
      },
      {
        name: 'Leadership & Teamwork',
        subtopics: ['Leading Initiatives', 'Handling Deadlines', 'Team Motivation']
      },
      {
        name: 'Conflict Resolution',
        subtopics: ['Technical Disagreements', 'Cross-Functional Alignment', 'Diplomatic Communication']
      },
      {
        name: 'Strengths & Weaknesses',
        subtopics: ['Self-Awareness', 'Growth Mindset', 'Constructive Improvement']
      },
      {
        name: 'Career Goals & Motivation',
        subtopics: ['Why This Company', '5-Year Vision', 'Company Culture Fit']
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
  if (raw === 'dsa' || raw.includes('data_structure') || raw.includes('algorithm') || raw.includes('programming')) {
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

  if (SUBJECTS[raw]) return raw;
  return 'quantitative_aptitude';
}

/**
 * Retrieve unique topics list for a subject
 */
export function getTopicsForSubject(subjectSlug?: string): string[] {
  const slug = normalizeSubjectSlug(subjectSlug);
  const cfg = SUBJECTS[slug];
  if (!cfg) return [];
  if (cfg.topics && cfg.topics.length > 0) {
    return cfg.topics.map(t => t.name);
  }
  return cfg.defaultTopics || [];
}

/**
 * Retrieve subtopics list for a given subject and topic
 */
export function getSubtopicsForTopic(subjectSlug: string, topicName: string): string[] {
  const slug = normalizeSubjectSlug(subjectSlug);
  const cfg = SUBJECTS[slug];
  if (!cfg || !cfg.topics) return [];

  const normTopic = topicName.trim().toLowerCase();
  for (const t of cfg.topics) {
    if (t.name.toLowerCase() === normTopic) {
      return t.subtopics || [];
    }
    if (t.aliases && t.aliases.some(a => a.toLowerCase() === normTopic)) {
      return t.subtopics || [];
    }
  }

  // Fuzzy check
  const found = cfg.topics.find(t => isTopicMatch(t.name, topicName));
  return found ? (found.subtopics || []) : [];
}

/**
 * Robust topic matching supporting aliases and canonical normalization
 */
export function isTopicMatch(candidateTopic?: string | null, targetTopic?: string | null): boolean {
  if (!candidateTopic || !targetTopic) return false;
  const c = candidateTopic.trim().toLowerCase();
  const t = targetTopic.trim().toLowerCase();

  if (c === t) return true;
  if (t === 'all' || t === 'all topics') return true;

  // Exact alphanumeric clean
  const cleanC = c.replace(/[^a-z0-9]/g, '');
  const cleanT = t.replace(/[^a-z0-9]/g, '');
  if (cleanC === cleanT) return true;

  // Special mappings for Time and Speed / Trains / Distance
  const timeSpeedPatterns = ['timeandspeed', 'timespeeddistance', 'speeddistancetime', 'speeddistance', 'trains', 'problemsontrains'];
  if (timeSpeedPatterns.includes(cleanT) && timeSpeedPatterns.includes(cleanC)) {
    return true;
  }

  // Check aliases from taxonomy
  for (const sub of Object.values(SUBJECTS)) {
    for (const top of sub.topics || []) {
      const topClean = top.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const aliasCleans = (top.aliases || []).map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const allVariants = [topClean, ...aliasCleans];
      if (allVariants.includes(cleanT) && allVariants.includes(cleanC)) {
        return true;
      }
    }
  }

  // Substring match for compound phrases
  if (cleanC.includes(cleanT) || cleanT.includes(cleanC)) {
    // Avoid false positives like "time" matching "time and work" when target is "time and speed"
    if ((cleanC.includes('work') && cleanT.includes('speed')) || (cleanC.includes('speed') && cleanT.includes('work'))) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Robust subtopic matching
 */
export function isSubtopicMatch(candidateSubtopic?: string | null, targetSubtopic?: string | null): boolean {
  if (!candidateSubtopic || !targetSubtopic) return false;
  const c = candidateSubtopic.trim().toLowerCase();
  const t = targetSubtopic.trim().toLowerCase();

  if (c === t) return true;
  if (t === 'all' || t === 'all subtopics') return true;

  const cleanC = c.replace(/[^a-z0-9]/g, '');
  const cleanT = t.replace(/[^a-z0-9]/g, '');
  if (cleanC === cleanT) return true;

  // Handle train problems
  if (cleanT.includes('train') && cleanC.includes('train')) return true;

  return cleanC.includes(cleanT) || cleanT.includes(cleanC);
}

