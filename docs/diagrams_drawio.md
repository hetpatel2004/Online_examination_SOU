# Online Examination System (SOU) — Draw.io Diagram Codes

This document contains diagram codes ready to paste directly into **[draw.io](https://app.diagrams.net/)**.

---

## How to Paste into Draw.io (Step-by-Step)
1. Open **[draw.io](https://app.diagrams.net/)** (or the Draw.io Desktop app).
2. Create a blank diagram.
3. In the top toolbar, click **`+` (Insert)**.
4. Hover over **`Advanced`**.
5. Choose **`Mermaid`** or **`PlantUML`** depending on the diagram below.
6. Paste the code into the text area.
7. Click **`Insert`**. Draw.io will automatically render the shapes, connectors, and layout!

---

## 1. Entity-Relationship (ER) Diagram (Mermaid)

> **Paste in Draw.io via:** `+` &rarr; `Advanced` &rarr; `Mermaid`

```mermaid
erDiagram
    USER {
        ObjectId _id PK
        string name
        string enrollmentNumber "UK (13 digits or ADMIN*)"
        string email "UK"
        string phone
        string course "e.g. MCA, MSCIT"
        string semester "1 to 8"
        string aadharNumber
        string password "bcrypt hash"
        string role "user | admin | superadmin"
        boolean isBlocked "default: false"
        date createdAt
        date updatedAt
    }

    COURSE {
        ObjectId _id PK
        string name
        string code "UK"
        string description
        string level "graduation | postgraduation"
        number totalSemesters "1 to 8"
        date createdAt
        date updatedAt
    }

    SUBJECT {
        ObjectId _id PK
        string name
        string code "UK"
        number semester "1 to 8"
        string course
        string description
        ObjectId assignedTo FK "references User"
        date createdAt
        date updatedAt
    }

    EXAM {
        ObjectId _id PK
        ObjectId subjectId FK "references Subject"
        string subjectName
        string subjectCode
        string date "YYYY-MM-DD"
        string time "HH:MM"
        number duration "in minutes"
        number semester
        string course
        number totalMarks
        number totalQuestions
        number questionsPerStudent
        string examType "mcq | practical"
        string resultDate
        string evaluationMethod "manual | ai"
        string evaluationStrictness "easy | medium | hard"
        date createdAt
        date updatedAt
    }

    QUESTION {
        ObjectId _id PK
        ObjectId examId FK "references Exam"
        string questionText
        string questionType "mcq | practical"
        array options "for MCQ (min 2)"
        string correctAnswer "for MCQ"
        number marks "default: 1"
        number order
        string modelAnswer "for practical"
        array testCases "input, expectedOutput"
        date createdAt
        date updatedAt
    }

    SUBMISSION {
        ObjectId _id PK
        ObjectId examId FK "references Exam"
        ObjectId studentId FK "references User"
        array assignedQuestions "array of Question IDs"
        array answers "questionId, answer"
        string answerFile "ZIP path"
        number score "final marks obtained"
        number totalMarks
        string status "submitted | graded | evaluated | disqualified"
        string disqualificationReason "e.g. tab switch"
        number correctnessScore "0-100"
        number qualityScore "0-100"
        string aiFeedback
        date submittedAt
        date createdAt
        date updatedAt
    }

    USER ||--o{ SUBJECT : "faculty assigned to"
    COURSE ||--o{ SUBJECT : "contains"
    SUBJECT ||--o{ EXAM : "scheduled for"
    EXAM ||--|{ QUESTION : "contains pool of"
    USER ||--o{ SUBMISSION : "submits"
    EXAM ||--o{ SUBMISSION : "records"
    QUESTION ||--o{ SUBMISSION : "evaluated in"
```

---

## 2. UML Class Diagram (Mermaid)

> **Paste in Draw.io via:** `+` &rarr; `Advanced` &rarr; `Mermaid`

```mermaid
classDiagram
    direction TB

    class UserModel {
        +ObjectId _id
        +String name
        +String enrollmentNumber
        +String email
        +String phone
        +String course
        +String semester
        +String password
        +String role
        +Boolean isBlocked
        +Date createdAt
    }

    class ExamModel {
        +ObjectId _id
        +ObjectId subjectId
        +String subjectName
        +String date
        +String time
        +Number duration
        +Number semester
        +String course
        +String examType
        +Number questionsPerStudent
        +String resultDate
        +Date createdAt
    }

    class QuestionModel {
        +ObjectId _id
        +ObjectId examId
        +String questionText
        +String questionType
        +Array options
        +String correctAnswer
        +Number marks
        +String modelAnswer
        +Array testCases
    }

    class SubmissionModel {
        +ObjectId _id
        +ObjectId examId
        +ObjectId studentId
        +Array answers
        +Number score
        +Number totalMarks
        +String status
        +String disqualificationReason
        +Number correctnessScore
        +Number qualityScore
        +String aiFeedback
        +Date submittedAt
    }

    class AuthController {
        +login(req, res)
        +register(req, res)
        +changePassword(req, res)
    }

    class AdminController {
        +getExams(req, res)
        +createExam(req, res)
        +updateExam(req, res)
        +deleteExam(req, res)
        +addQuestion(req, res)
        +bulkUploadQuestions(req, res)
        +getSubmissions(req, res)
        +evaluateSubmission(req, res)
    }

    class SuperAdminController {
        +getAdmins(req, res)
        +createAdmin(req, res)
        +getStudents(req, res)
        +toggleBlockStudent(req, res)
        +resetPassword(req, res)
    }

    class ExamTakingController {
        +getStudentExams(req, res)
        +getQuestions(req, res)
        +submitExam(req, res)
        +disqualifyStudent(req, res)
        +runCode(req, res)
    }

    class AIEvaluationService {
        +evaluateSubmission(answers, questions, options)
        +analyzeCode(studentCode, language, prompt)
        +hasAIKey() Boolean
    }

    class CodeExecutionService {
        +executeCode(code, language, input)
        +runJudge0(code, langId, input)
        +runLocalFallback(code, lang, input)
    }

    AuthController ..> UserModel : validates & authenticates
    AdminController ..> ExamModel : schedules & manages
    AdminController ..> QuestionModel : manages pool
    AdminController ..> SubmissionModel : reviews & grades
    SuperAdminController ..> UserModel : manages accounts
    ExamTakingController ..> ExamModel : queries
    ExamTakingController ..> SubmissionModel : writes
    ExamTakingController ..> CodeExecutionService : invokes for test runs
    AdminController ..> AIEvaluationService : triggers auto-grade
    AIEvaluationService ..> CodeExecutionService : runs test cases
    ExamModel "1" *-- "*" QuestionModel : contains
    ExamModel "1" *-- "*" SubmissionModel : receives
    UserModel "1" *-- "*" SubmissionModel : submits
```

---

## 3. UML Sequence Diagram: Student Exam & Anti-Cheat Flow (Mermaid)

> **Paste in Draw.io via:** `+` &rarr; `Advanced` &rarr; `Mermaid`

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Browser as React Frontend (Cloudflare)
    participant Backend as Express API (Render)
    participant DB as MongoDB Atlas
    participant Sandbox as Judge0 / AI Service

    Student->>Browser: Opens Exam Portal & Logs in
    Browser->>Backend: POST /api/auth/login
    Backend->>DB: Verify enrollment & bcrypt password
    DB-->>Backend: User Profile & Role
    Backend-->>Browser: Signed JWT Token

    Student->>Browser: Clicks "Start Exam"
    Browser->>Backend: GET /api/exams/:id/questions
    Backend->>DB: Sample random questions (questionsPerStudent)
    DB-->>Backend: Assigned Questions Pool
    Backend-->>Browser: Questions List (Loaded in React State)

    Browser->>Browser: Enters Fullscreen & Starts Timer (setInterval)
    Note over Browser,Student: Zero server network traffic during test answering

    alt Academic Dishonesty Detected (Tab Switch or Blur)
        Student->>Browser: Switches Tab / Minimizes Browser
        Browser->>Browser: Event: visibilitychange / blur triggered!
        Browser->>Backend: POST /api/exams/:id/disqualify
        Backend->>DB: Save Submission (status: 'disqualified', score: 0)
        DB-->>Backend: Confirmed
        Backend-->>Browser: Disqualification Recorded
        Browser-->>Student: Modal: "You have been disqualified for switching tabs"
    else Normal Exam Submission (MCQ or Practical)
        Student->>Browser: Answers Questions / Types Code & Clicks "Submit"
        Browser->>Backend: POST /api/exams/:id/submit
        alt MCQ Exam
            Backend->>Backend: In-memory O(1) answer key scoring
            Backend->>DB: Save Submission (status: 'graded', score: X)
            DB-->>Backend: Saved
            Backend-->>Browser: HTTP 200 (Success Confirmation)
        else Practical Coding Exam
            Backend->>Sandbox: Execute code against test cases & AI review
            Sandbox-->>Backend: Output, correctness score & feedback
            Backend->>DB: Save Submission (status: 'evaluated', marks: Y)
            DB-->>Backend: Saved
            Backend-->>Browser: HTTP 200 (Grading Complete)
        end
        Browser-->>Student: Displays "Exam Submitted Successfully"
    end
```

---

## 4. UML Use Case Diagram (PlantUML)

> **Paste in Draw.io via:** `+` &rarr; `Advanced` &rarr; `PlantUML`

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle

actor "Student" as student
actor "Faculty Admin" as admin
actor "Super Admin" as superadmin

rectangle "Online Examination System (SOU)" {
  ' Common
  usecase "Login & Authenticate" as UC_Login
  usecase "Change Password" as UC_CP

  ' Student Use Cases
  usecase "View Assigned Exams\n(by Sem & Course)" as UC_S_ViewExams
  usecase "Take Exam (Fullscreen Lock)" as UC_S_TakeExam
  usecase "Live Code Execution Sandbox" as UC_S_RunCode
  usecase "Submit Exam" as UC_S_Submit
  usecase "Anti-Cheat Enforcement\n(Tab Blur Auto-Disqualify)" as UC_S_AntiCheat
  usecase "View Results & Feedback\n(after resultDate)" as UC_S_ViewResults

  ' Faculty Admin Use Cases
  usecase "View Assigned Subjects" as UC_A_Subjects
  usecase "Create & Schedule Exam\n(Newest at Top)" as UC_A_CreateExam
  usecase "Manage Questions Pool\n& Test Cases" as UC_A_Questions
  usecase "Evaluate Practical Code\n& Trigger AI Grading" as UC_A_Grade
  usecase "Export Submissions to CSV" as UC_A_Export

  ' Super Admin Use Cases
  usecase "Manage Faculty Admins\n(Create, Delete, Reset)" as UC_SA_Admins
  usecase "Manage Students\n(Search, Block, Reset Password)" as UC_SA_Students
  usecase "Manage Course Catalog\n& Assign Subjects" as UC_SA_Courses
  usecase "View University Dashboard\n& System Analytics" as UC_SA_Stats
}

' Student connections
student --> UC_Login
student --> UC_CP
student --> UC_S_ViewExams
student --> UC_S_TakeExam
student --> UC_S_RunCode
student --> UC_S_Submit
student --> UC_S_ViewResults
UC_S_TakeExam ..> UC_S_AntiCheat : <<includes>>

' Admin connections
admin --> UC_Login
admin --> UC_CP
admin --> UC_A_Subjects
admin --> UC_A_CreateExam
admin --> UC_A_Questions
admin --> UC_A_Grade
admin --> UC_A_Export

' Super Admin connections
superadmin --> UC_Login
superadmin --> UC_CP
superadmin --> UC_SA_Admins
superadmin --> UC_SA_Students
superadmin --> UC_SA_Courses
superadmin --> UC_SA_Stats

@enduml
```
