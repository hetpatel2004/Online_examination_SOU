# -*- coding: utf-8 -*-
"""
render_highres_diagrams.py
Renders all 8 ACUMEN system diagrams at ultra-high resolution (2x DPI, 2800x2200 viewport),
then automatically crops the exact bounding box of the diagram.
Guarantees full-page horizontal and vertical clarity with zero wasted white margins.
"""

import os
import subprocess
import time
from PIL import Image, ImageChops

WORKSPACE_DIR = r"D:\Desktop\Online_examination_SOU"
FIGURES_DIR = os.path.join(WORKSPACE_DIR, "documentation", "figures")
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

diagram_definitions = [
    {
        "id": "fig_4_1_architecture",
        "title": "Figure 4.1: System Architecture Diagram – Three-Tier ACUMEN Platform",
        "code": """flowchart TD
    subgraph PresentationTier["Tier 1: Presentation Layer (Vite + React 19 SPA)"]
        direction LR
        UI["React 19 User Interface (Tailwind & CSS3)"]
        MonacoEditor["Monaco IDE (Multi-Language Code Editor)"]
        ProctoringGuard["Proctoring Guard (Visibility & Blur Telemetry)"]
        StudentPortal["Student Dashboard & Scorecard View"]
        AdminPortal["Faculty / Admin Dashboard & Reports"]
    end

    subgraph ApplicationTier["Tier 2: Application & API Layer (Node.js & Express API Gateway)"]
        direction TB
        APIGateway["Express.js RESTful API Gateway (/api)"]
        AuthModule["JWT Authentication & RBAC Middleware"]
        CurriculumService["Curriculum & Course Management Service"]
        ExamService["Examination & Ingestion Service"]
        
        subgraph EvaluationSubsystem["AI & AST Multi-Tier Evaluation Engine"]
            GeminiAI["Tier 1: Google Gemini 2.5 Flash LLM Engine"]
            ASTDecompiler["Tier 2: AST Construct Decompiler & Heuristic Parser"]
            Scorer["Construct-by-Construct Mark Allocator"]
        end

        SandboxEngine["Isolated Multi-Language Sandbox (Judge0 / Node / Python)"]
        NotificationEngine["Comms Service (Fast2SMS & Nodemailer SMTP)"]
    end

    subgraph DataTier["Tier 3: Data & Infrastructure Layer (Cloud Services)"]
        direction LR
        SupabaseDB[("Supabase PostgreSQL Cloud Relational Database")]
        CloudflareEdge["Cloudflare Pages Global CDN Edge"]
        NotificationGateways["SMS (Fast2SMS) & Email (Gmail SMTP) Gateways"]
    end

    PresentationTier <-->|"HTTPS / REST JSON Payloads"| APIGateway
    APIGateway --> AuthModule
    AuthModule --> CurriculumService
    AuthModule --> ExamService
    ExamService --> EvaluationSubsystem
    ExamService --> SandboxEngine
    ExamService --> NotificationEngine
    EvaluationSubsystem <-->|"Async Analysis Query & Response"| GeminiAI
    EvaluationSubsystem --> SupabaseDB
    CurriculumService --> SupabaseDB
    NotificationEngine --> NotificationGateways
    CloudflareEdge --> PresentationTier
"""
    },
    {
        "id": "fig_4_2_dfd_level_0",
        "title": "Figure 4.2: Data Flow Diagram (Level 0) – Context Diagram",
        "code": """flowchart TD
    Student["👨‍🎓 Student<br/>(Examinee)"]
    Faculty["👨‍🏫 Faculty / Admin<br/>(Examiner)"]
    SuperAdmin["🛡️ Super Admin<br/>(University Controller)"]
    AIService["🤖 Google Gemini 2.5 Flash<br/>(LLM AI Engine)"]
    CommsService["📱 SMS & Email Gateway<br/>(Fast2SMS & Nodemailer)"]

    Process0(("0.0<br/>ACUMEN EXAMINATION<br/>& ASSESSMENT PLATFORM<br/>(Central Processing System)"))

    Student <-->|"Login Credentials, Exam Responses, Practical Code, Tab Telemetry / Auth Token, Questions, Scorecard"| Process0
    Faculty <-->|"Exam Setup, Question Bank Upload, Result Approvals / Submissions Roster, Evaluated Code, Class Analytics"| Process0
    SuperAdmin <-->|"Faculty Account Provisioning, Global System Config / University Audit Logs, Institution-wide Metrics"| Process0
    Process0 <-->|"Code Snippet + Model Answer Prompt / Construct Breakdown & Numerical Marks JSON"| AIService
    Process0 -->|"Exam Schedule Reminders & Result Notification Payloads / SMS & Email Alerts"| CommsService
"""
    },
    {
        "id": "fig_4_3_dfd_level_1",
        "title": "Figure 4.3: Data Flow Diagram (Level 1) – Decomposed Functional Process Workflow",
        "code": """flowchart TD
    Student["👨‍🎓 Student"]
    Faculty["👨‍🏫 Faculty / Admin"]

    Process1["1.0<br/>Authentication & Role Verification"]
    Process2["2.0<br/>Exam Schedule & Question Provisioning"]
    Process3["3.0<br/>Monaco IDE & Real-Time Assessment Session"]
    Process4["4.0<br/>Automated AST & Gemini AI Code Evaluation"]
    Process5["5.0<br/>Result Collation, Analytics & Grade Dispatch"]

    DB_Users[("D1: Users Store")]
    DB_Exams[("D2: Exams & Questions Store")]
    DB_Submissions[("D3: Submissions Store")]
    DB_Telemetry[("D4: Telemetry & Audit Logs")]

    GeminiEngine["🤖 Gemini 2.5 Flash AI"]

    Student -->|"Credentials"| Process1
    Faculty -->|"Admin Auth"| Process1
    Process1 <-->|"Verify Hashes & Roles"| DB_Users

    Process1 -->|"Session Token"| Process2
    Process2 <-->|"Fetch Questions"| DB_Exams
    Process2 -->|"Question Payloads"| Process3

    Student -->|"Code & Telemetry Beacons"| Process3
    Process3 -->|"Record Blur / Tab Events"| DB_Telemetry
    Process3 -->|"Dispatched Code Payload"| Process4

    Process4 <-->|"AST Extraction & LLM Prompting"| GeminiEngine
    Process4 -->|"Persist Graded Scores & Feedback"| DB_Submissions

    DB_Submissions -->|"Aggregate Scores"| Process5
    Process5 -->|"Class Performance Rosters"| Faculty
    Process5 -->|"Certified Marksheet"| Student
"""
    },
    {
        "id": "fig_4_4_dfd_level_2",
        "title": "Figure 4.4: Data Flow Diagram (Level 2) – Detailed AST & AI Code Evaluation Subsystem",
        "code": """flowchart TD
    SubmissionIn["Code Submission Payload (Language, Source Code, Student ID, Exam ID)"]

    SubProcess1["4.1<br/>Sanitization & Syntax Validation"]
    SubProcess2["4.2<br/>Dynamic Test Case Execution (Judge0 / Sandbox)"]
    SubProcess3["4.3<br/>Abstract Syntax Tree (AST) Decompilation"]
    SubProcess4["4.4<br/>Gemini 2.5 Flash Semantic Logic Evaluation"]
    SubProcess5["4.5<br/>Weighted Multi-Factor Score Aggregation"]

    DB_TestCases[("D5: Visible & Hidden Test Cases")]
    DB_Scores[("D6: Submission Evaluation Reports")]

    SubmissionIn --> SubProcess1
    SubProcess1 -->|"Valid Code"| SubProcess2
    SubProcess1 -->|"Valid Code"| SubProcess3

    SubProcess2 <-->|"Fetch I/O Fixtures"| DB_TestCases
    SubProcess2 -->|"Test Case Pass/Fail Ratio (60% Weight)"| SubProcess5

    SubProcess3 -->|"Syntactic Construct Breakdown"| SubProcess4
    SubProcess3 -->|"AST Structural Validity (20% Weight)"| SubProcess5

    SubProcess4 -->|"Semantic Correctness & Complexity (20% Weight)"| SubProcess5

    SubProcess5 -->|"Final Normalized Mark (0-100) + Feedback JSON"| DB_Scores
"""
    },
    {
        "id": "fig_4_5_erd",
        "title": "Figure 4.5: Entity-Relationship (ER) Diagram – Complete Relational Schema & Cardinality",
        "code": """erDiagram
    USERS ||--o{ EXAMS : "creates (1:N)"
    USERS ||--o{ SUBMISSIONS : "submits (1:N)"
    EXAMS ||--|{ QUESTIONS : "contains (1:N)"
    QUESTIONS ||--|{ TEST_CASES : "defines (1:N)"
    QUESTIONS ||--o{ SUBMISSIONS : "receives (1:N)"
    SUBMISSIONS ||--o{ TELEMETRY_LOGS : "generates (1:N)"

    USERS {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        string role
        string enrollment_no
        timestamp created_at
    }

    EXAMS {
        uuid id PK
        uuid created_by FK
        string title
        text description
        integer duration_mins
        timestamp start_time
        timestamp end_time
        boolean is_active
    }

    QUESTIONS {
        uuid id PK
        uuid exam_id FK
        string title
        text problem_statement
        string allowed_languages
        text starter_code
        integer max_score
        string difficulty
    }

    TEST_CASES {
        uuid id PK
        uuid question_id FK
        text input_data
        text expected_output
        boolean is_hidden
        integer points
    }

    SUBMISSIONS {
        uuid id PK
        uuid question_id FK
        uuid student_id FK
        text code_content
        string language
        integer test_cases_passed
        integer total_test_cases
        decimal ai_score
        text ai_feedback
        string status
    }

    TELEMETRY_LOGS {
        uuid id PK
        uuid submission_id FK
        string event_type
        integer strike_number
        timestamp timestamp
        string ip_address
    }
"""
    },
    {
        "id": "fig_4_6_use_case",
        "title": "Figure 4.6: Unified System Use Case Diagram – Candidate, Examiner, and Admin Workflows",
        "code": """flowchart LR
    subgraph Actors["System Actors"]
        Student["👨‍🎓 Student / Examinee"]
        Faculty["👨‍🏫 Faculty / Examiner"]
        Admin["🛡️ System Administrator"]
    end

    subgraph StudentUseCases["Student Assessment Workflows"]
        UC1["Sign In & Verify SOU Enrollment"]
        UC2["Access Timed Practical Examination"]
        UC3["Write & Compile in Monaco IDE"]
        UC4["Run Visible Test Cases"]
        UC5["Submit Final Code for Evaluation"]
        UC6["Receive Proctoring Strike Warnings"]
        UC7["View Instant Score & AI Feedback"]
    end

    subgraph FacultyUseCases["Faculty / Examiner Workflows"]
        UC8["Create & Schedule Exams"]
        UC9["Add Questions & Dynamic Test Cases"]
        UC10["Monitor Live Student Telemetry"]
        UC11["Review Automated AI Grade Reports"]
        UC12["Override / Adjust Partial Credit"]
        UC13["Export Class Marksheets (CSV/PDF)"]
    end

    subgraph AdminUseCases["System Admin Workflows"]
        UC14["User Account & Role Management"]
        UC15["Audit Trail & System Health Logs"]
        UC16["Cloudflare & Database Monitoring"]
    end

    Student --> UC1
    Student --> UC2
    Student --> UC3
    Student --> UC4
    Student --> UC5
    Student --> UC6
    Student --> UC7

    Faculty --> UC8
    Faculty --> UC9
    Faculty --> UC10
    Faculty --> UC11
    Faculty --> UC12
    Faculty --> UC13

    Admin --> UC14
    Admin --> UC15
    Admin --> UC16
"""
    },
    {
        "id": "fig_4_7_class_diagram",
        "title": "Figure 4.7: Object-Oriented Domain Class Diagram – Core Architectural Entities & Services",
        "code": """classDiagram
    class User {
        +UUID id
        +String email
        +String passwordHash
        +String role
        +String enrollmentNo
        +register()
        +login()
        +verifyToken()
    }

    class Exam {
        +UUID id
        +String title
        +Integer durationMins
        +DateTime startTime
        +DateTime endTime
        +Boolean isActive
        +isLive()
        +getQuestions()
    }

    class Question {
        +UUID id
        +UUID examId
        +String title
        +String problemStatement
        +String[] allowedLanguages
        +getTestCases()
    }

    class TestCase {
        +UUID id
        +UUID questionId
        +String inputData
        +String expectedOutput
        +Boolean isHidden
        +Integer points
        +executeAgainst(code)
    }

    class Submission {
        +UUID id
        +UUID questionId
        +UUID studentId
        +String codeContent
        +String language
        +Integer testsPassed
        +Float aiScore
        +String aiFeedback
        +String status
        +evaluate()
        +lockSession()
    }

    class TelemetryLog {
        +UUID id
        +UUID submissionId
        +String eventType
        +Integer strikeNumber
        +DateTime timestamp
        +logViolation()
    }

    class AuthService {
        +issueJWT(user)
        +verifyRole(token, role)
        +hashPassword(plain)
    }

    class GeminiEvaluator {
        +parseAST(code, lang)
        +scoreSemanticLogic(code, problem)
        +generateFeedback(ast, prompt)
    }

    User "1" --> "*" Exam : authors
    User "1" --> "*" Submission : submits
    Exam "1" *-- "*" Question : contains
    Question "1" *-- "*" TestCase : defines
    Question "1" --> "*" Submission : targets
    Submission "1" *-- "*" TelemetryLog : tracks
    Submission ..> GeminiEvaluator : calls
    User ..> AuthService : authenticates
"""
    },
    {
        "id": "fig_4_8_sequence_diagram",
        "title": "Figure 4.8: UML Sequence Diagram – Anti-Cheat Telemetry, Submission & AI Assessment",
        "code": """sequenceDiagram
    autonumber
    actor Student as 👨‍🎓 Student
    participant Browser as 💻 React 19 Client (Monaco)
    participant Daemon as 🛡️ Proctoring Daemon
    participant API as ⚙️ Express REST API
    participant Judge as ⚡ Test Case Runner
    participant Gemini as 🤖 Gemini 2.5 Flash LLM
    participant DB as 🗄️ PostgreSQL Database
    actor Faculty as 👨‍🏫 Faculty

    Student->>Browser: Selects Exam & Starts Coding
    Browser->>Daemon: Initiates Telemetry Listeners
    
    rect rgb(254, 242, 242)
        Note over Student, Daemon: Integrity Violation Interception
        Student->>Browser: Switches Tab / Alt-Tab (Blur)
        Daemon->>Daemon: Increment Strike Count (Strike = 1)
        Daemon-->>Student: Display Warning Toast Alert
        Daemon->>API: POST /api/telemetry/log (tab_switch)
        API->>DB: INSERT into telemetry_logs
    end

    Student->>Browser: Enters Final Code & Clicks Submit
    Browser->>API: POST /api/exam/submit {code, questionId}
    API->>DB: INSERT into submissions (status='evaluating')
    
    par Parallel Dynamic & Static Assessment
        API->>Judge: Run Code against Test Cases
        Judge-->>API: Test Pass Ratio: 5/5 Passed (60 pts)
    and
        API->>Gemini: Analyze AST & Semantic Logic
        Gemini-->>API: Logic Sound: O(N) Complexity (40 pts)
    end

    API->>API: Compute Aggregate Score (100/100)
    API->>DB: UPDATE submissions (score=100, status='graded')
    API-->>Browser: Return Final Scorecard & AI Feedback
    Browser-->>Student: Display Certified Results
    DB-->>Faculty: Real-Time Grade Update on Dashboard
"""
    }
]

def generate_html_files():
    print("Generating updated high-resolution HTML files...")
    for diag in diagram_definitions:
        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="../mermaid.min.js"></script>
  <style>
    body {{
      margin: 0;
      padding: 20px;
      background: #ffffff;
      font-family: 'Segoe UI', Arial, sans-serif;
      display: inline-block;
    }}
    .wrapper {{
      background: #ffffff;
      border: 2px solid #334155;
      border-radius: 10px;
      padding: 24px 30px;
      display: inline-block;
      text-align: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.10);
    }}
    .title {{
      font-size: 20px;
      font-weight: bold;
      color: #003366;
      margin-bottom: 20px;
      letter-spacing: 0.3px;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="title">{diag["title"]}</div>
    <div class="mermaid">
{diag["code"]}
    </div>
  </div>
  <script>
    mermaid.initialize({{
      startOnLoad: true,
      theme: 'default',
      themeVariables: {{
        fontSize: '17px',
        fontFamily: "'Segoe UI', Arial, sans-serif",
        primaryColor: '#e0f2fe',
        primaryBorderColor: '#0284c7',
        primaryTextColor: '#0f172a',
        lineColor: '#334155',
        secondaryColor: '#f1f5f9',
        tertiaryColor: '#ffffff'
      }}
    }});
  </script>
</body>
</html>"""
        html_path = os.path.join(FIGURES_DIR, f"{diag['id']}.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

def render_and_crop():
    print("Rendering high-res screenshots via Chrome...")
    for diag in diagram_definitions:
        diag_id = diag["id"]
        html_path = os.path.join(FIGURES_DIR, f"{diag_id}.html")
        png_path = os.path.join(FIGURES_DIR, f"{diag_id}.png")
        file_url = "file:///" + html_path.replace("\\", "/")

        cmd = [
            CHROME_PATH,
            "--headless=new",
            "--disable-gpu",
            "--allow-file-access-from-files",
            "--force-device-scale-factor=2.0",
            "--window-size=2800,2200",
            f"--screenshot={png_path}",
            file_url
        ]
        
        proc = subprocess.run(cmd, capture_output=True, text=True)
        time.sleep(0.5)

        # Auto crop to exact content bounding box
        if os.path.exists(png_path):
            try:
                im = Image.open(png_path)
                bg = Image.new("RGB", im.size, (255, 255, 255))
                im_rgb = im.convert("RGB")
                diff = ImageChops.difference(im_rgb, bg)
                bbox = diff.getbbox()
                if bbox:
                    pad = 16
                    cropped = im.crop((
                        max(0, bbox[0] - pad),
                        max(0, bbox[1] - pad),
                        min(im.size[0], bbox[2] + pad),
                        min(im.size[1], bbox[3] + pad)
                    ))
                    cropped.save(png_path)
                    print(f"Rendered & Cropped {diag_id}.png: {cropped.size} (aspect={cropped.size[0]/cropped.size[1]:.2f})")
            except Exception as e:
                print(f"Error cropping {diag_id}: {e}")

if __name__ == "__main__":
    generate_html_files()
    render_and_crop()
