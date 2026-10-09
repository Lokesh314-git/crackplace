import { supabase } from '../config/supabase';

interface QuestionSeed {
  question_id: string;
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  question_type: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  source: string;
}

const SEED_QUESTIONS: QuestionSeed[] = [
  // ==========================================
  // DSA (Data Structures & Algorithms)
  // ==========================================
  {
    question_id: 'DSA1001',
    subject: 'dsa',
    topic: 'Arrays',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'What is the time complexity of accessing an element in an array by its index?',
    option_a: 'O(1)',
    option_b: 'O(N)',
    option_c: 'O(log N)',
    option_d: 'O(N^2)',
    correct_answer: 'A',
    explanation: 'Arrays offer direct random access via memory offset calculation in O(1) constant time.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1002',
    subject: 'dsa',
    topic: 'Arrays',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'Kadane’s algorithm is used to solve which standard algorithmic problem?',
    option_a: 'Longest Common Subsequence',
    option_b: 'Maximum Subarray Sum',
    option_c: 'Finding cycle in a graph',
    option_d: 'Shortest path in unweighted graph',
    correct_answer: 'B',
    explanation: 'Kadane’s algorithm finds the contiguous subarray with maximum sum in linear O(N) time.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1003',
    subject: 'dsa',
    topic: 'Arrays',
    difficulty: 'Hard',
    question_type: 'MCQ',
    question: 'Given an array of N integers where every element appears twice except one, which bitwise operator finds the unique element in O(N) time and O(1) space?',
    option_a: 'AND (&)',
    option_b: 'OR (|)',
    option_c: 'XOR (^)',
    option_d: 'NOT (~)',
    correct_answer: 'C',
    explanation: 'XORing all elements eliminates duplicates since X ^ X = 0 and X ^ 0 = X, leaving the single unique number.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1004',
    subject: 'dsa',
    topic: 'Linked Lists',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'What is the time complexity to insert a node at the beginning of a singly linked list with a given head pointer?',
    option_a: 'O(1)',
    option_b: 'O(N)',
    option_c: 'O(log N)',
    option_d: 'O(N log N)',
    correct_answer: 'A',
    explanation: 'Inserting at head requires updating the new node\'s next pointer and head pointer, taking O(1) time.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1005',
    subject: 'dsa',
    topic: 'Linked Lists',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'Which algorithm uses two pointers (slow and fast) to detect a loop/cycle in a linked list?',
    option_a: 'Dijkstra’s Algorithm',
    option_b: 'Floyd’s Cycle Finding Algorithm',
    option_c: 'Kruskal’s Algorithm',
    option_d: 'Tarjan’s Algorithm',
    correct_answer: 'B',
    explanation: 'Floyd\'s Tortoise and Hare algorithm detects linked list cycles in O(N) time and O(1) auxiliary space.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1006',
    subject: 'dsa',
    topic: 'Stacks & Queues',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'Which data structure follows the Last-In-First-Out (LIFO) principle?',
    option_a: 'Queue',
    option_b: 'Stack',
    option_c: 'Binary Tree',
    option_d: 'Linked List',
    correct_answer: 'B',
    explanation: 'A Stack operates on the LIFO principle where elements added last are removed first.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1007',
    subject: 'dsa',
    topic: 'Stacks & Queues',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'What is the minimum number of standard FIFO queues required to implement a LIFO stack?',
    option_a: '1',
    option_b: '2',
    option_c: '3',
    option_d: '4',
    correct_answer: 'B',
    explanation: 'Two queues are typically used to implement a stack by transferring elements between them to invert order.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1008',
    subject: 'dsa',
    topic: 'Trees & BST',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'Which tree traversal visits nodes in the order: Left Subtree, Root Node, Right Subtree?',
    option_a: 'Preorder Traversal',
    option_b: 'Inorder Traversal',
    option_c: 'Postorder Traversal',
    option_d: 'Level Order Traversal',
    correct_answer: 'B',
    explanation: 'Inorder traversal visits Left -> Root -> Right. In a BST, inorder traversal yields sorted order.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1009',
    subject: 'dsa',
    topic: 'Trees & BST',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'What is the maximum number of nodes in a binary tree of height H (where height of root node is 1)?',
    option_a: '2^H - 1',
    option_b: '2^H + 1',
    option_c: '2^(H - 1)',
    option_d: 'H^2',
    correct_answer: 'A',
    explanation: 'A full binary tree of height H has sum of 2^(i-1) from i=1 to H, which equals 2^H - 1 nodes.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1010',
    subject: 'dsa',
    topic: 'Trees & BST',
    difficulty: 'Hard',
    question_type: 'MCQ',
    question: 'In an AVL Tree, what is the maximum allowed difference between the heights of the left and right subtrees of any node?',
    option_a: '0',
    option_b: '1',
    option_c: '2',
    option_d: 'log N',
    correct_answer: 'B',
    explanation: 'AVL trees maintain balance factor in {-1, 0, +1}, so the height difference is at most 1.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1011',
    subject: 'dsa',
    topic: 'Graphs',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'What is the time complexity of Breadth-First Search (BFS) on a graph with V vertices and E edges represented using an Adjacency List?',
    option_a: 'O(V)',
    option_b: 'O(E)',
    option_c: 'O(V + E)',
    option_d: 'O(V * E)',
    correct_answer: 'C',
    explanation: 'BFS visits each vertex once and checks each edge once in an adjacency list, giving O(V + E) time.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1012',
    subject: 'dsa',
    topic: 'Graphs',
    difficulty: 'Hard',
    question_type: 'MCQ',
    question: 'Which algorithm finds all-pairs shortest paths in a directed weighted graph, allowing negative edge weights (but no negative cycles)?',
    option_a: 'Dijkstra’s Algorithm',
    option_b: 'Prim’s Algorithm',
    option_c: 'Floyd-Warshall Algorithm',
    option_d: 'Kruskal’s Algorithm',
    correct_answer: 'C',
    explanation: 'Floyd-Warshall uses dynamic programming in O(V^3) to find all-pairs shortest paths and can handle negative edges.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1013',
    subject: 'dsa',
    topic: 'Dynamic Programming',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'What is the time complexity to solve the standard 0/1 Knapsack problem with N items and maximum weight capacity W using Dynamic Programming?',
    option_a: 'O(N)',
    option_b: 'O(N * W)',
    option_c: 'O(2^N)',
    option_d: 'O(N log W)',
    correct_answer: 'B',
    explanation: 'The 2D dynamic programming table size is (N+1) x (W+1), filled in O(N * W) pseudo-polynomial time.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1014',
    subject: 'dsa',
    topic: 'Sorting & Searching',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'What is the best-case time complexity of standard Insertion Sort on an already sorted array?',
    option_a: 'O(N^2)',
    option_b: 'O(N log N)',
    option_c: 'O(N)',
    option_d: 'O(1)',
    correct_answer: 'C',
    explanation: 'When the array is already sorted, Insertion Sort performs only 1 comparison per element without shifting, running in O(N).',
    source: 'Placement Prep'
  },
  {
    question_id: 'DSA1015',
    subject: 'dsa',
    topic: 'Sorting & Searching',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'Which sorting algorithm is guaranteed to have O(N log N) worst-case time complexity, is stable, and uses O(N) extra space?',
    option_a: 'QuickSort',
    option_b: 'HeapSort',
    option_c: 'MergeSort',
    option_d: 'SelectionSort',
    correct_answer: 'C',
    explanation: 'MergeSort divides the array and merges halves stably in O(N log N) time in all cases with O(N) auxiliary space.',
    source: 'Placement Prep'
  },

  // ==========================================
  // DBMS (Database Management Systems)
  // ==========================================
  {
    question_id: 'DBMS1001',
    subject: 'dbms',
    topic: 'SQL Queries',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'Which SQL clause is used to filter records returned by an aggregate function like COUNT() or AVG()?',
    option_a: 'WHERE',
    option_b: 'HAVING',
    option_c: 'GROUP BY',
    option_d: 'ORDER BY',
    correct_answer: 'B',
    explanation: 'WHERE filters rows before aggregation, while HAVING filters grouped results after aggregation.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DBMS1002',
    subject: 'dbms',
    topic: 'SQL Queries',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'What is the difference between DELETE and TRUNCATE in SQL?',
    option_a: 'DELETE is DDL while TRUNCATE is DML',
    option_b: 'DELETE logs row-by-row deletions and can be rolled back; TRUNCATE deallocates data pages and is faster',
    option_c: 'TRUNCATE allows a WHERE clause while DELETE does not',
    option_d: 'TRUNCATE removes the table definition from database schema',
    correct_answer: 'B',
    explanation: 'TRUNCATE is a DDL command that resets high watermark and deallocates pages quickly, whereas DELETE is a DML statement logging individual rows.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DBMS1003',
    subject: 'dbms',
    topic: 'Normalization',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'A relational table is in First Normal Form (1NF) if and only if:',
    option_a: 'All attributes have atomic (indivisible) values and no repeating groups exist',
    option_b: 'Every non-prime attribute is fully functionally dependent on primary key',
    option_c: 'There are no transitive functional dependencies',
    option_d: 'Every determinant is a superkey',
    correct_answer: 'A',
    explanation: '1NF requires all domain column values to be atomic and columns cannot contain arrays or repeating groups.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DBMS1004',
    subject: 'dbms',
    topic: 'Normalization',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'Which normal form eliminates transitive functional dependencies between non-prime attributes?',
    option_a: '1NF',
    option_b: '2NF',
    option_c: '3NF',
    option_d: 'BCNF',
    correct_answer: 'C',
    explanation: 'Third Normal Form (3NF) requires 2NF plus no transitive dependencies (X -> Y -> Z where X is PK).',
    source: 'Placement Prep'
  },
  {
    question_id: 'DBMS1005',
    subject: 'dbms',
    topic: 'Transactions & ACID',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'Which ACID property ensures that the database remains in a valid state before and after transaction execution?',
    option_a: 'Atomicity',
    option_b: 'Consistency',
    option_c: 'Isolation',
    option_d: 'Durability',
    correct_answer: 'B',
    explanation: 'Consistency guarantees that all integrity constraints, schema rules, and cascades are preserved.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DBMS1006',
    subject: 'dbms',
    topic: 'Transactions & ACID',
    difficulty: 'Hard',
    question_type: 'MCQ',
    question: 'In SQL transaction isolation levels, what is a "Phantom Read"?',
    option_a: 'A transaction reads data modified by an uncommitted transaction',
    option_b: 'A transaction re-reads a row and finds that data was modified by another committed transaction',
    option_c: 'A transaction executes a query reading a set of rows satisfying a condition, but upon re-querying finds new matching rows inserted by another committed transaction',
    option_d: 'A deadlock where two transactions wait for lock releases indefinitely',
    correct_answer: 'C',
    explanation: 'Phantom reads occur when a transaction queries a range of records and another transaction inserts or deletes rows matching that range.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DBMS1007',
    subject: 'dbms',
    topic: 'Indexing & B-Trees',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'What is a Clustered Index in relational databases?',
    option_a: 'An index created on foreign key columns only',
    option_b: 'An index that determines the physical order of data rows in the table',
    option_c: 'An index stored in memory that points to disk blocks',
    option_d: 'A hash index that supports fast range searches',
    correct_answer: 'B',
    explanation: 'A clustered index physically sorts the table data rows on disk matching the index key. There can be only one clustered index per table.',
    source: 'Placement Prep'
  },
  {
    question_id: 'DBMS1008',
    subject: 'dbms',
    topic: 'Joins & Subqueries',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'Which type of SQL join produces the Cartesian product of two tables when no join predicate is specified?',
    option_a: 'INNER JOIN',
    option_b: 'LEFT OUTER JOIN',
    option_c: 'CROSS JOIN',
    option_d: 'FULL OUTER JOIN',
    correct_answer: 'C',
    explanation: 'A CROSS JOIN returns every combination of rows from table A with table B (size = N * M).',
    source: 'Placement Prep'
  },

  // ==========================================
  // Operating Systems
  // ==========================================
  {
    question_id: 'OS1001',
    subject: 'operating_system',
    topic: 'CPU Scheduling',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'Which CPU scheduling algorithm gives each process a fixed time slice (quantum) in cyclic order?',
    option_a: 'First-Come First-Served (FCFS)',
    option_b: 'Round Robin (RR)',
    option_c: 'Shortest Job First (SJF)',
    option_d: 'Priority Scheduling',
    correct_answer: 'B',
    explanation: 'Round Robin assigns a uniform CPU time quantum to each ready process in a circular queue.',
    source: 'Placement Prep'
  },
  {
    question_id: 'OS1002',
    subject: 'operating_system',
    topic: 'CPU Scheduling',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'What is the "Convoy Effect" in operating systems scheduling?',
    option_a: 'Short processes waiting behind a long CPU-intensive process in FCFS scheduling',
    option_b: 'Processes starving because higher priority tasks keep arriving',
    option_c: 'Thrashing due to insufficient physical page frames',
    option_d: 'Deadlock between multiple threads acquiring mutual exclusion locks',
    correct_answer: 'A',
    explanation: 'The convoy effect occurs in FCFS where short I/O-bound processes are blocked waiting for a single long CPU-bound process.',
    source: 'Placement Prep'
  },
  {
    question_id: 'OS1003',
    subject: 'operating_system',
    topic: 'Process Synchronization',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'What are the two atomic operations associated with counting semaphores?',
    option_a: 'get() and set()',
    option_b: 'wait() (or P) and signal() (or V)',
    option_c: 'lock() and unlock()',
    option_d: 'push() and pop()',
    correct_answer: 'B',
    explanation: 'Dijkstra defined semaphores with atomic operations P (wait/decrement) and V (signal/increment).',
    source: 'Placement Prep'
  },
  {
    question_id: 'OS1004',
    subject: 'operating_system',
    topic: 'Deadlocks',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'Which of the following is an algorithm used for Deadlock Avoidance in operating systems?',
    option_a: 'Round Robin Algorithm',
    option_b: 'Banker’s Algorithm',
    option_c: 'Kruskal’s Algorithm',
    option_d: 'Page Replacement Algorithm',
    correct_answer: 'B',
    explanation: 'Banker\'s Algorithm tests for safe state by simulating resource allocation against maximum claim vectors.',
    source: 'Placement Prep'
  },
  {
    question_id: 'OS1005',
    subject: 'operating_system',
    topic: 'Memory Management & Paging',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'What is "Thrashing" in a virtual memory operating system?',
    option_a: 'Excessive CPU context switching due to high thread count',
    option_b: 'A state where the system spends more time swapping pages in and out of disk than executing instructions',
    option_c: 'Memory corruption caused by illegal pointer dereferences',
    option_d: 'Unrecoverable disk sector read failures',
    correct_answer: 'B',
    explanation: 'Thrashing occurs when the working sets of active processes exceed available RAM, causing continuous page faulting.',
    source: 'Placement Prep'
  },
  {
    question_id: 'OS1006',
    subject: 'operating_system',
    topic: 'Memory Management & Paging',
    difficulty: 'Hard',
    question_type: 'MCQ',
    question: 'Which page replacement algorithm replaces the page that will not be used for the longest period of time in the future?',
    option_a: 'FIFO (First-In First-Out)',
    option_b: 'LRU (Least Recently Used)',
    option_c: 'OPT / MIN (Optimal Page Replacement)',
    option_d: 'LFU (Least Frequently Used)',
    correct_answer: 'C',
    explanation: 'Optimal (Belady\'s OPT) replaces the page with the furthest future reference; it serves as theoretical benchmark.',
    source: 'Placement Prep'
  },

  // ==========================================
  // Computer Networks
  // ==========================================
  {
    question_id: 'CN1001',
    subject: 'computer_network',
    topic: 'OSI & TCP/IP Models',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'How many layers are there in the standard ISO-OSI reference model?',
    option_a: '4',
    option_b: '5',
    option_c: '7',
    option_d: '9',
    correct_answer: 'C',
    explanation: 'The OSI model defines 7 layers: Physical, Data Link, Network, Transport, Session, Presentation, Application.',
    source: 'Placement Prep'
  },
  {
    question_id: 'CN1002',
    subject: 'computer_network',
    topic: 'IP Addressing & Subnetting',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'How many usable host IP addresses are available in a /28 IPv4 subnet?',
    option_a: '14',
    option_b: '16',
    option_c: '30',
    option_d: '32',
    correct_answer: 'A',
    explanation: 'A /28 subnet has 32 - 28 = 4 host bits (2^4 = 16 total). Subtracting network and broadcast addresses leaves 14 usable hosts.',
    source: 'Placement Prep'
  },
  {
    question_id: 'CN1003',
    subject: 'computer_network',
    topic: 'TCP vs UDP Protocols',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'Which transport layer protocol provides connection-oriented, reliable, byte-stream transmission with congestion control?',
    option_a: 'UDP',
    option_b: 'TCP',
    option_c: 'ICMP',
    option_d: 'IP',
    correct_answer: 'B',
    explanation: 'TCP (Transmission Control Protocol) implements connection establishment (3-way handshake), ACKs, retransmissions, and congestion control.',
    source: 'Placement Prep'
  },
  {
    question_id: 'CN1004',
    subject: 'computer_network',
    topic: 'Routing Algorithms',
    difficulty: 'Hard',
    question_type: 'MCQ',
    question: 'Which problem is associated with the Distance Vector routing algorithm (like RIP) and mitigated by Split Horizon and Poison Reverse?',
    option_a: 'Count-to-Infinity Problem',
    option_b: 'Dijkstra Loop Collision',
    option_c: 'SYN Flood',
    option_d: 'Broadcast Storm',
    correct_answer: 'A',
    explanation: 'Distance Vector routing can suffer from routing loops and slow convergence known as the Count-to-Infinity problem.',
    source: 'Placement Prep'
  },
  {
    question_id: 'CN1005',
    subject: 'computer_network',
    topic: 'Application Layer (HTTP/DNS)',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'What is the default port number used for secure HTTPS web traffic?',
    option_a: '80',
    option_b: '443',
    option_c: '8080',
    option_d: '21',
    correct_answer: 'B',
    explanation: 'HTTPS operates by default over TCP port 443, whereas unencrypted HTTP uses port 80.',
    source: 'Placement Prep'
  },

  // ==========================================
  // Logical Reasoning & Puzzles
  // ==========================================
  {
    question_id: 'LR1001',
    subject: 'logical_reasoning',
    topic: 'Blood Relations',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'Pointing to a photograph, John says: "She is the daughter of my grandfather\'s only son." How is the girl in the photograph related to John?',
    option_a: 'Mother',
    option_b: 'Sister',
    option_c: 'Aunt',
    option_d: 'Cousin',
    correct_answer: 'B',
    explanation: 'Grandfather\'s only son = John\'s father. Daughter of John\'s father = John\'s sister.',
    source: 'Placement Prep'
  },
  {
    question_id: 'LR1002',
    subject: 'logical_reasoning',
    topic: 'Direction Sense',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'A man walks 4 km North, turns right and walks 3 km. How far is he from his starting point in a straight line?',
    option_a: '7 km',
    option_b: '5 km',
    option_c: '6 km',
    option_d: '1 km',
    correct_answer: 'B',
    explanation: 'Using Pythagorean theorem: sqrt(4^2 + 3^2) = sqrt(16 + 9) = sqrt(25) = 5 km.',
    source: 'Placement Prep'
  },
  {
    question_id: 'LR1003',
    subject: 'logical_reasoning',
    topic: 'Number & Alphabet Series',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'Find the missing number in the sequence: 3, 7, 15, 31, 63, ?',
    option_a: '95',
    option_b: '127',
    option_c: '120',
    option_d: '115',
    correct_answer: 'B',
    explanation: 'Each term is generated by (2 * previous_term) + 1. Thus: (2 * 63) + 1 = 126 + 1 = 127.',
    source: 'Placement Prep'
  },
  {
    question_id: 'LR1004',
    subject: 'logical_reasoning',
    topic: 'Syllogisms',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'Statements: 1. All cats are animals. 2. All animals are mammals. Conclusion I: All cats are mammals. Conclusion II: Some mammals are cats.',
    option_a: 'Only Conclusion I follows',
    option_b: 'Only Conclusion II follows',
    option_c: 'Both Conclusion I and II follow',
    option_d: 'Neither conclusion follows',
    correct_answer: 'C',
    explanation: 'Since Cats subset of Animals subset of Mammals, all cats are mammals (I) and some mammals are cats (II) both hold true.',
    source: 'Placement Prep'
  },
  {
    question_id: 'LR1005',
    subject: 'logical_reasoning',
    topic: 'Coding-Decoding',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'If in a certain code language, "APPLE" is coded as "EQTPI" (+4 shift on each letter), how is "CODE" coded with the same rule?',
    option_a: 'GSHI',
    option_b: 'GSII',
    option_c: 'HTHI',
    option_d: 'GRHI',
    correct_answer: 'A',
    explanation: 'C(+4)=G, O(+4)=S, D(+4)=H, E(+4)=I => GSHI.',
    source: 'Placement Prep'
  },

  // ==========================================
  // Verbal Ability & English
  // ==========================================
  {
    question_id: 'VA1001',
    subject: 'verbal_ability',
    topic: 'Sentence Correction & Grammar',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'Choose the grammatically correct sentence:',
    option_a: 'Neither the manager nor the employees was present at the meeting.',
    option_b: 'Neither the manager nor the employees were present at the meeting.',
    option_c: 'Neither the manager or the employees was present at the meeting.',
    option_d: 'Neither the manager nor the employees are been present.',
    correct_answer: 'B',
    explanation: 'In "neither...nor" constructions, the verb agrees in number with the closer subject ("employees" -> plural -> "were").',
    source: 'Placement Prep'
  },
  {
    question_id: 'VA1002',
    subject: 'verbal_ability',
    topic: 'Vocabulary (Synonyms/Antonyms)',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'What is the SYNONYM of the word "EPHEMERAL"?',
    option_a: 'Eternal',
    option_b: 'Transitory / Short-lived',
    option_c: 'Substantial',
    option_d: 'Enigmatic',
    correct_answer: 'B',
    explanation: 'Ephemeral means lasting for a very short time; fleeting or transitory.',
    source: 'Placement Prep'
  },
  {
    question_id: 'VA1003',
    subject: 'verbal_ability',
    topic: 'Vocabulary (Synonyms/Antonyms)',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'What is the ANTONYM of the word "MITIGATE"?',
    option_a: 'Alleviate',
    option_b: 'Aggravate',
    option_c: 'Moderate',
    option_d: 'Assuage',
    correct_answer: 'B',
    explanation: 'To mitigate is to lessen or make less severe. The opposite is to aggravate or worsen.',
    source: 'Placement Prep'
  },
  {
    question_id: 'VA1004',
    subject: 'verbal_ability',
    topic: 'Idioms & Phrases',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'What does the idiom "Bite the bullet" mean?',
    option_a: 'To eat something very hard',
    option_b: 'To face a difficult or unpleasant situation with courage and fortitude',
    option_c: 'To start a physical fight',
    option_d: 'To make an avoidable mistake',
    correct_answer: 'B',
    explanation: '"Bite the bullet" means accepting an inevitable grim situation stoically.',
    source: 'Placement Prep'
  },
  {
    question_id: 'VA1005',
    subject: 'verbal_ability',
    topic: 'Error Spotting',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'Identify the part containing an error: "One of the best players (A) / in our university team (B) / have been selected (C) / for national trials (D)."',
    option_a: 'Part A',
    option_b: 'Part B',
    option_c: 'Part C',
    option_d: 'Part D',
    correct_answer: 'C',
    explanation: 'The subject is "One", which is singular. Therefore, it must be "has been selected" instead of "have been selected".',
    source: 'Placement Prep'
  },

  // ==========================================
  // HR & Behavioral
  // ==========================================
  {
    question_id: 'HR1001',
    subject: 'hr_behavioral',
    topic: 'STAR Method Behavioral',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'What does the acronym "STAR" stand for in behavioral interview methodology?',
    option_a: 'Strategy, Tactics, Action, Review',
    option_b: 'Situation, Task, Action, Result',
    option_c: 'Skills, Teamwork, Assessment, Reward',
    option_d: 'Structure, Testing, Alignment, Release',
    correct_answer: 'B',
    explanation: 'The STAR framework structures behavioral answers into Situation, Task, Action, and Result.',
    source: 'Placement Prep'
  },
  {
    question_id: 'HR1002',
    subject: 'hr_behavioral',
    topic: 'Conflict Resolution',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'When asked by an interviewer how you handle a technical disagreement with a team member, which approach is most effective?',
    option_a: 'Insist on your solution because you are confident in your coding style',
    option_b: 'Escalate immediately to the department manager to decide',
    option_c: 'Engage in objective discussion with data, evaluate trade-offs collaboratively, and build consensus',
    option_d: 'Ignore the conflict and work completely independently',
    correct_answer: 'C',
    explanation: 'Effective workplace collaboration focuses on data-backed discussions, trade-off analysis, and mutual consensus.',
    source: 'Placement Prep'
  },
  {
    question_id: 'HR1003',
    subject: 'hr_behavioral',
    topic: 'Strengths & Weaknesses',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'What is the most professional way to answer "What is your biggest weakness?" in a campus interview?',
    option_a: 'State that you have no weaknesses and perform flawlessly',
    option_b: 'Share a genuine technical or soft skill area you identified, along with concrete steps and progress you are making to improve it',
    option_c: 'Say you work too hard and are a perfectionist',
    option_d: 'Mention that you dislike teamwork and prefer working alone',
    correct_answer: 'B',
    explanation: 'Self-awareness combined with proactive, demonstrable self-improvement shows maturity and growth mindset.',
    source: 'Placement Prep'
  },
  {
    question_id: 'HR1004',
    subject: 'hr_behavioral',
    topic: 'Career Goals & Motivation',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'When asked "Why do you want to join our company?", which response demonstrates the strongest preparation?',
    option_a: '"Because you offer the highest starting salary on campus."',
    option_b: '"Because my friends applied and recommended I apply too."',
    option_c: '"I researched your recent engineering products and architecture, and my skills in fullstack development align with your team mission to solve scale challenges."',
    option_d: '"I just need a placement offer to graduate."',
    correct_answer: 'C',
    explanation: 'Demonstrating product knowledge and connecting your capabilities to the company\'s engineering goals demonstrates high motivation.',
    source: 'Placement Prep'
  },
  {
    question_id: 'HR1005',
    subject: 'hr_behavioral',
    topic: 'Leadership & Teamwork',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'A teammate is falling behind on their deliverable before a project deadline. What is the most constructive action?',
    option_a: 'Report their delay to the professor or manager without speaking to them',
    option_b: 'Reach out to understand the blocker, offer paired problem-solving, and reallocate tasks if needed',
    option_c: 'Do nothing as it is solely their personal responsibility',
    option_d: 'Take full credit for the entire project deliverable',
    correct_answer: 'B',
    explanation: 'Great teammates offer proactive support, diagnose blockers, and collaborate to ensure the team succeeds.',
    source: 'Placement Prep'
  }
];

async function seed() {
  console.log(`Starting to seed ${SEED_QUESTIONS.length} questions across all placement subjects...`);
  
  // Upsert questions
  for (const q of SEED_QUESTIONS) {
    const { data, error } = await supabase
      .from('questions')
      .upsert(
        {
          question_id: q.question_id,
          subject: q.subject,
          topic: q.topic,
          subtopic: q.subtopic || null,
          difficulty: q.difficulty,
          question_type: q.question_type,
          question: q.question,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          source: q.source,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'question_id' }
      );

    if (error) {
      console.error(`Error inserting ${q.question_id}:`, error.message);
    } else {
      console.log(`✓ Inserted/Updated ${q.question_id} (${q.subject} - ${q.topic})`);
    }
  }

  console.log('Seeding completed successfully!');
}

seed().catch(console.error);
