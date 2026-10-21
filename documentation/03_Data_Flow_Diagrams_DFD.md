# Data Flow Diagrams (DFD) — Level 0, Level 1 & Level 2
**Project**: SOU SmartExam — Online Examination & Intelligent Assessment Platform  
**Institution**: Silver Oak University (SOU), Ahmedabad  
**Author**: Het Patel (MCA Semester 3)

---

## 1. DFD Level 0 — Context Diagram

The Context Diagram defines the system boundary, external entities interacting with the application, and the primary input/output data flows.

```mermaid
flowchart TD
    subgraph External Entities
        Student["👨‍🎓 Student"]
        Faculty["👨‍🏫 Faculty / Admin"]
        SuperAdmin["🛡️ Super Admin"]
        AIService["🤖 Google Gemini / OpenAI Cloud API"]
        CommsService["📱 SMS (Fast2SMS) & Email (SMTP) Gateway"]
    end

    Process0(("0.0 SOU SmartExam Platform"))

    Student -->|"Credentials, Exam Answers, Code Submissions, Tab Telemetry"| Process0
    Process0 -->|"Auth Token, Exam Questions, Sandbox Output, Annotated Scorecard"| Student

    Faculty -->|"Course/Subject Details, Exam Schedules, Question Banks, Manual Marks"| Process0
    Process0 -->|"Submissions, Auto-Generated Solutions, AI Evaluations, Class Analytics"| Faculty

    SuperAdmin -->|"Admin Provisioning, Course Management, Global Broadcasts"| Process0
    Process0 -->|"System Audit Logs, Institution-wide Exam Metrics"| SuperAdmin

    Process0 -->|"Prompt: Question + Model Answer + Student Code + Testcases"| AIService
    AIService -->|"JSON Evaluation: Logic Score, Construct Breakdown, Annotated Code"| Process0

    Process0 -->|"Dispatch SMS / Email Notification Payloads"| CommsService
    CommsService -->|"Delivery Status Confirmation"| Process0
```

---

## 2. DFD Level 1 — System Process Decomposition

Decomposes the core system into 6 discrete functional processes and identifies interactions with physical MongoDB data stores.

```mermaid
flowchart TD
    Student["👨‍🎓 Student"]
    Faculty["👨‍🏫 Faculty / Admin"]

    subgraph Data Stores
        D1[("D1: Users")]
        D2[("D2: Courses & Subjects")]
        D3[("D3: Exams")]
        D4[("D4: Questions")]
        D5[("D5: Submissions & Breakdowns")]
        D6[("D6: Notifications")]
    end

    subgraph Processes
        P1(("1.0 Authentication & RBAC"))
        P2(("2.0 Curriculum & Exam Management"))
        P3(("3.0 Exam Delivery & Proctoring Monitor"))
        P4(("4.0 Sandboxed Code Execution"))
        P5(("5.0 Dual-Tier AI Evaluation Engine"))
        P6(("6.0 Result Publication & Analytics"))
    end

    Student -->|Credentials| P1
    Faculty -->|Credentials| P1
    P1 <-->|Read / Write Auth Data| D1
    P1 -->|JWT Claims| Student
    P1 -->|JWT Claims| Faculty

    Faculty -->|Schedules, Questions, Strictness| P2
    P2 <-->|Subjects| D2
    P2 <-->|Exam Records| D3
    P2 <-->|Question Bank & Testcases| D4

    Student -->|Exam Initiation| P3
    D3 -->|Fetch Exam Config| P3
    D4 -->|Randomized Questions| P3
    P3 -->|Interactive Code Editor / Questions| Student
    Student -->|Blur Events & Tab Switches| P3
    P3 -->|Disqualification Trigger| D5

    Student -->|Code Run Request| P4
    P4 -->|Execution Output stdout/stderr| Student

    Student -->|Final Submit| P5
    D4 -->|Reference Model Answer & Testcases| P5
    P4 -->|Sandbox Runtime Output| P5
    P5 -->|Construct Marks Breakdown & Annotated Code| D5

    D5 -->|Submissions Data| P6
    D3 -->|Embargo Date Check| P6
    P6 -->|Performance Analytics| Faculty
    P6 -->|Detailed Scorecard & Breakdowns| Student
    P6 -->|Alert Payloads| D6
```

---

## 3. DFD Level 2 — Decomposition of Process 5.0 (AI Code Evaluation)

Provides an in-depth breakdown of how practical student code submissions are automatically transformed into granular construct-by-construct scores.

```mermaid
flowchart TD
    StudentCode["Student Code Submission"]
    QuestionMeta["Question Statement & Total Marks"]
    ModelAnswer["Reference Solution & Testcases"]

    subgraph "Process 5.0: AI Evaluation Pipeline"
        P51(("5.1 Testcase & Sandbox Verifier"))
        P52(("5.2 Semantic Logic Review (Gemini LLM)"))
        P53(("5.3 AST Construct Parser & Decompiler"))
        P54(("5.4 Construct Mark Allocator & Decomposer"))
        P55(("5.5 Code Annotator & Score Synthesizer"))
    end

    D5[("D5: Submissions Collection")]

    StudentCode --> P51
    ModelAnswer --> P51
    P51 -->|Execution Status: Exit Code, stdout, stderr| P52
    P51 -->|Execution Status: Pass/Fail Ratio| P54

    StudentCode --> P52
    QuestionMeta --> P52
    ModelAnswer --> P52
    P52 -->|AI Logic & Accuracy Analysis| P54

    StudentCode --> P53
    P53 -->|Extracted Construct Nodes: Function, Condition, Loop, Return| P54

    QuestionMeta -->|Total Marks: e.g. 45m| P54
    P54 -->|Condition: 22m, Loop: 23m| P55
    StudentCode --> P55

    P55 -->|Construct Breakdown Table| D5
    P55 -->|Annotated Code with Line Marks| D5
    P55 -->|Final Computed Marks & aiFeedback| D5
```

---

## 4. Data Dictionary: Key Data Flows

| Data Flow Name | Source Process/Entity | Destination Process/Entity | Data Elements |
| :--- | :--- | :--- | :--- |
| `Student Submission` | Student Portal | Process 5.0 | `examId`, `studentId`, `answers: [{ questionId, answer, language }]` |
| `Execution Telemetry` | Process 4.0 (Sandbox) | Process 5.0 | `exitCode`, `stdout`, `stderr`, `executionTime`, `memoryUsed` |
| `AST Construct Map` | Process 5.3 | Process 5.4 | `foundComponents: [{ type: 'condition', lineIndex: 1, codeSnippet: 'if (num < 0)...' }]` |
| `Construct Allocation` | Process 5.4 | Process 5.5 | `breakdown: [{ component, codeSnippet, maxMarks, awardedMarks, status, comment }]` |
| `Evaluation Result` | Process 5.5 | D5: Submissions | `score`, `totalMarks`, `correctnessScore`, `qualityScore`, `codeBreakdown`, `annotatedCode` |
| `Published Scorecard`| Process 6.0 | Student Portal | Detailed marks, component table, line-by-line annotations, feedback summary |
