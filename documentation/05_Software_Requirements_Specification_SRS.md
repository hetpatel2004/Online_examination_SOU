# Software Requirements Specification (SRS)
**Project**: ACUMEN — AI-Driven Code Understanding & Monitored Examination Network  
**Subtitle**: Intelligent Practical Code Assessment & Real-Time Integrity Guardian  
**Standard**: IEEE 830-1998 Compliant  
**Institution**: Silver Oak University (SOU), Ahmedabad  
**Author**: Het Patel (MCA Semester 3)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) details the functional and non-functional requirements for **ACUMEN** (AI-Driven Code Understanding & Monitored Examination Network), an enterprise-level online examination and automated assessment system designed for Silver Oak University.

### 1.2 Scope of the Software
The platform supports:
- Theoretical multiple-choice question (MCQ) examinations.
- Practical multi-language programming examinations (Python, JavaScript, Java, C, C++, HTML/CSS, React).
- Automated AI-assisted code evaluation with construct-level mark decomposition.
- Active browser proctoring with a 3-strike tab detection and disqualification system.
- Result embargo scheduling and transparent line-by-line annotated scorecard publication.

---

## 2. Functional Requirements (FR)

### Module 1: User & Authentication Management
- **FR-01 [User Onboarding]**: The system shall allow students to register by providing legal name, enrollment number, university email, mobile phone, course, and semester.
- **FR-02 [Authentication]**: The system shall authenticate users via enrollment number/email and password, returning a signed JWT token valid for the session.
- **FR-03 [Role-Based Access Control]**: The system shall restrict endpoint access based on assigned user roles: `student`, `admin`, and `superadmin`.

### Module 2: Curriculum & Exam Scheduling
- **FR-04 [Curriculum Hierarchy]**: The system shall maintain an academic hierarchy linking Courses $\rightarrow$ Semesters $\rightarrow$ Subjects $\rightarrow$ Exams.
- **FR-05 [Exam Scheduling]**: Faculty shall be able to schedule examinations by selecting course, semester, subject, exam date, start time, duration, exam type, and evaluation mode.
- **FR-06 [Question Pool Ingestion]**: Faculty shall be able to upload question pools via CSV or modal dialogs.
- **FR-07 [Randomized Question Distribution]**: The system shall support assigning a randomized subset of $K$ questions from a pool of $N$ questions to each student.

### Module 3: Examination Interface & Proctoring
- **FR-08 [Monaco Code Editor]**: For practical exams, the student portal shall provide an integrated code editor with syntax highlighting, line numbering, and bracket matching.
- **FR-09 [Code Execution Sandbox]**: Students shall be able to execute code against custom inputs and view standard output, error streams, and execution duration before submitting.
- **FR-10 [Active Proctoring & 3-Strike Rule]**: The system shall monitor browser visibility and window focus. Upon a tab switch or window blur, it shall display an interactive warning modal. On the 3rd strike, the session shall be terminated and marked as `'disqualified'`.

### Module 4: Automated Code Evaluation & Scoring
- **FR-11 [Construct-by-Construct Decomposition]**: The evaluation engine shall decompose student solutions into distinct constructs (function interface, guard conditions, iteration loops, output statements) and apportion the question's total marks accordingly.
- **FR-12 [Dual-Tier Fallback]**: The system shall evaluate code via Google Gemini 1.5 Flash when available, and fall back to an intelligent AST decompiler if offline, ensuring 100% evaluation availability.
- **FR-13 [Zero-Length Bias]**: The evaluation algorithm shall score code strictly on logic, accuracy, and edge-case handling, without penalizing concise solutions based on line count.

### Module 5: Result Publication & Analytics
- **FR-14 [Result Embargo Date]**: Faculty shall be able to specify a future publication datetime; scores and breakdowns shall remain strictly hidden from students until this timestamp elapses.
- **FR-15 [Line-by-Line Annotated Scorecard]**: Upon result publication, students shall be able to view an annotated code preview with awarded marks indicated directly above each code construct.

---

## 3. Non-Functional Requirements (NFR)

- **NFR-01 [Performance & Latency]**: Automated AI and AST evaluation shall return comprehensive results within **3.0 seconds** per submission under normal network conditions.
- **NFR-02 [Concurrency & Scalability]**: The REST API and database shall support at least **500 concurrent examination sessions** without transaction deadlocks.
- **NFR-03 [Security & Cryptography]**: Passwords shall be hashed using salted bcrypt ($2a$10$). All API endpoints shall validate bearer JWT tokens.
- **NFR-04 [Data Integrity]**: A unique compound index `{ examId: 1, studentId: 1 }` shall prevent duplicate exam submissions.
- **NFR-05 [Usability & Accessibility]**: The interface shall follow responsive design standards, providing high contrast, accessible fonts, and seamless desktop/tablet compatibility.
