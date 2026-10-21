# 📚 ACUMEN - AI-Driven Code Understanding & Monitored Examination Network
### Intelligent Practical Code Assessment & Real-Time Integrity Guardian
**Silver Oak University • Silver Oak College of Computer Applications (SOCCA)**  
**Team SOCCA-18**: Het K Patel (`2504070200049`) & Dharmik Makwana (`2504070200012`) | **Program**: M.Sc. IT Semester 3  

Welcome to the central documentation and design repository for **ACUMEN** for **AAVISHKAR 2026**.

This folder is positioned at the root directory alongside `frontend/` and `backend/` to provide a complete, standalone documentation package for students, evaluators, project guides, and developers.

---

## 📁 Repository Directory Structure

```text
Online_examination_SOU/
├── backend/                               # Express.js REST API & AI evaluation engine
├── frontend/                              # Vite + React 18 student & admin portals
└── documentation/                         # 📍 Unified Documentation Suite
    ├── README.md                          # Master index and documentation guide
    ├── AAVISHKAR_Project_Poster.pdf       # High-resolution print-ready AAVISHKAR 2026 poster
    ├── 01_Entity_Relationship_Diagram_ERD.md
    ├── 02_Use_Case_Diagram_and_Specifications.md
    ├── 03_Data_Flow_Diagrams_DFD.md
    ├── 04_System_Architecture_and_Design.md
    ├── 05_Software_Requirements_Specification_SRS.md
    ├── 06_REST_API_Documentation.md
    ├── 07_AAVISHKAR_Comprehensive_Project_Report.md
    └── 08_Visual_Diagrams_Viewer.html
```

---

## 📑 Document Catalog & Summaries

| Document | File Name | Description & Key Contents |
| :--- | :--- | :--- |
| **00. Master Poster** | [`AAVISHKAR_Project_Poster.pdf`](./AAVISHKAR_Project_Poster.pdf) | Official print-ready A1/A2 poster for AAVISHKAR 2026 exhibition. Includes Silver Oak University crest, UN SDG alignment (SDG 4, 9, 12 highlighted), system architecture, AI code evaluation engine breakdown, proctoring security metrics, and live Cloudflare deployment link. |
| **01. ERD** | [`01_Entity_Relationship_Diagram_ERD.md`](./01_Entity_Relationship_Diagram_ERD.md) | Complete Entity Relationship Diagram in Mermaid format, document schemas for MongoDB (`users`, `courses`, `subjects`, `exams`, `questions`, `submissions`, `notifications`), 1-to-N relationships, indexes, and data dictionary. |
| **02. Use Cases** | [`02_Use_Case_Diagram_and_Specifications.md`](./02_Use_Case_Diagram_and_Specifications.md) | Visual Mermaid Use Case diagram covering Student, Faculty/Admin, Superadmin, AI Evaluator, and Proctoring Guard actors. Contains 8 formal use case specifications (preconditions, normal flows, exception flows, postconditions). |
| **03. DFD** | [`03_Data_Flow_Diagrams_DFD.md`](./03_Data_Flow_Diagrams_DFD.md) | Structured Data Flow Diagrams across three decomposition tiers: **Level 0** (Context Diagram), **Level 1** (Subsystem Overview), and **Level 2** (Detailed AI Code Evaluation pipeline and AST logic verification). |
| **04. Architecture** | [`04_System_Architecture_and_Design.md`](./04_System_Architecture_and_Design.md) | 3-Tier Enterprise Architectural Blueprint: Client Layer (React 18 SPA + Monaco Editor + Anti-Cheating Guardian), Application Layer (Express REST + Worker Pool), AI Engine (Gemini 1.5 Flash + Isolated Docker Sandbox), and Database Layer (MongoDB Atlas Cluster). |
| **05. SRS** | [`05_Software_Requirements_Specification_SRS.md`](./05_Software_Requirements_Specification_SRS.md) | IEEE 830-1998 compliant Software Requirements Specification covering 15 Functional Requirements (FR-01 to FR-15) and 5 Non-Functional Requirements (Performance, Scalability, Security, Integrity, Usability). |
| **06. REST APIs** | [`06_REST_API_Documentation.md`](./06_REST_API_Documentation.md) | Detailed endpoint specifications with HTTP verbs, authentication headers, request payloads, sample JSON responses, and error codes for Authentication, Subjects, Exams, Questions, Practical Code Submissions, and Admin services. |
| **07. Project Report** | [`07_AAVISHKAR_Comprehensive_Project_Report.md`](./07_AAVISHKAR_Comprehensive_Project_Report.md) | Comprehensive Academic Project File fulfilling AAVISHKAR Guidelines (Sec 2.4). Includes University Certificate, Problem Statement, Methodology, Step-by-Step Scoring Algorithms, Experimental Results & Benchmarks, SDG Alignment, and References. |
| **08. Interactive Viewer** | [`08_Visual_Diagrams_Viewer.html`](./08_Visual_Diagrams_Viewer.html) | Standalone interactive web portal. Open in any modern web browser (Chrome, Edge, Firefox) to view, zoom, and inspect all ERDs, Use Cases, DFDs, and Architecture diagrams rendered natively via Mermaid.js with instant tab switching. |

---

## 🚀 How to View the Diagrams & Documents

### Option 1: Interactive Browser Viewer (Recommended)
Double-click [`08_Visual_Diagrams_Viewer.html`](./08_Visual_Diagrams_Viewer.html) or run:
```powershell
Start-Process "08_Visual_Diagrams_Viewer.html"
```
This renders interactive, high-definition SVG diagrams for:
- Entity Relationship Diagram (ERD)
- Use Case Hierarchy
- DFD Level 0, Level 1, and Level 2
- System Architecture Diagram

### Option 2: Print / Review the Poster PDF
Open [`AAVISHKAR_Project_Poster.pdf`](./AAVISHKAR_Project_Poster.pdf) in Chrome, Adobe Acrobat, or any PDF reader:
```powershell
Start-Process "AAVISHKAR_Project_Poster.pdf"
```

### Option 3: Markdown Editors or GitHub
All `.md` files contain standard GitHub Flavored Markdown and native Mermaid syntax. They render directly in VS Code / Antigravity preview (`Ctrl+Shift+V`) and on GitHub.
