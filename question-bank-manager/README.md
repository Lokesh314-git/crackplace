# CrackPlace AI — Question Bank Manager

> **Administrative Question Bank Portal, CSV Batch Ingestion & Validation Tool for Supabase PostgreSQL**

The Question Bank Manager is a dedicated web interface for administrators and curriculum curators to upload, validate, inspect, edit, and organize placement assessment questions in the centralized Supabase PostgreSQL database.

---

## 🌟 Key Features

- **Multi-Subject Ingestion**:
  - `quantitative_aptitude` — Quantitative Aptitude, Math, Arithmetic
  - `dsa` — Data Structures, Algorithms, Programming Concepts
  - `dbms` — Database Concepts, Normalization, SQL Queries
  - `operating_system` — Processes, Threads, Memory Management, Linux
  - `computer_network` — OSI Model, Protocols, Subnetting, Security
  - `logical_reasoning` — Puzzles, Syllogisms, Series, Analytical
  - `verbal_ability` — Grammar, Reading Comprehension, Sentence Correction
  - `hr_behavioral` — STAR Method, Situational Scenarios
- **Bulk CSV Upload & Validation**:
  - Live CSV parsing and schema verification.
  - Automatic duplicate detection using SHA-256 question-text and options hashing.
  - Validation of minimum option counts, correct answer mappings (A, B, C, D), and explanations.
- **Direct Database Management**:
  - Filter by subject, difficulty (`Easy`, `Medium`, `Hard`), topic, and company tags.
  - Inline question editing and deletion.
  - Option distribution balance analysis.

---

## 🛠️ Technology Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS
- **Database Client**: `@supabase/supabase-js`
- **CSV Parsing**: PapaParse

---

## 📂 Project Structure

```
question-bank-manager/
├── src/
│   ├── components/          # CSV uploader, question table, modal editors
│   ├── config/              # Supabase client initialization
│   ├── types/               # Database row models and subject definitions
│   ├── utils/               # CSV validator and duplicate hash checkers
│   ├── App.tsx              # Main manager view
│   └── main.tsx             # Application bootstrap
├── crackplace_question_template.csv  # Standard CSV template for batch import
├── crackplace_sample_questions.csv   # Sample questions across all 8 subjects
├── .env.example             # Template for required Supabase credentials
├── package.json             # Scripts and dependencies
└── vite.config.ts           # Bundler configuration
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Supabase Project URL and Anon/Publishable Key

### Installation

```bash
# Clone the repository
git clone https://github.com/Lokesh314-git/crackplace-questions-manger.git
cd crackplace-questions-manger

# Install dependencies
npm install
```

### Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your Supabase project credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-key
```

### Running Locally

```bash
npm run dev
```

The portal will open on `http://localhost:5173` (or the next available local port).

---

## 📄 CSV Template Format

The importer expects a standard CSV with the following header columns:

```csv
question_id,subject,topic,subtopic,difficulty,company,question,option_a,option_b,option_c,option_d,correct_answer,explanation
```

| Column | Type | Allowed Values / Description |
| :--- | :--- | :--- |
| `question_id` | String | Unique question identifier (e.g., `DSA_001`, `QA_042`) |
| `subject` | String | `quantitative_aptitude`, `dsa`, `dbms`, `operating_system`, `computer_network`, `logical_reasoning`, `verbal_ability`, `hr_behavioral` |
| `topic` | String | Topic category (e.g. `Binary Trees`, `Percentages`, `SQL Joins`) |
| `difficulty` | String | `Easy`, `Medium`, `Hard` |
| `company` | String | Target company tag (e.g. `Google`, `Amazon`, `TCS`, `General`) |
| `question` | String | Full markdown-supported question prompt |
| `option_a` | String | Option A text |
| `option_b` | String | Option B text |
| `option_c` | String | Option C text |
| `option_d` | String | Option D text |
| `correct_answer` | Char | Exact uppercase letter: `A`, `B`, `C`, or `D` |
| `explanation` | String | Comprehensive solution and explanation text |

---

## 📦 Production Build

```bash
npm run build
```

---

## 🛡️ Security

- **Never Use Service Role Key in Frontend**: Only use the public anon/publishable key with Row Level Security (RLS) policies configured in Supabase.

---

## 📄 License

MIT License.
