# REST API Reference & Endpoint Documentation
**Project**: SOU SmartExam — Online Examination & Intelligent Assessment Platform  
**Base URL**: `https://api.online-examination-sou.pages.dev/api` (or `http://localhost:5000/api`)  
**Authorization**: `Bearer <JWT_TOKEN>` in HTTP Header  
**Content-Type**: `application/json`

---

## 1. Authentication Endpoints (`/api/auth`)

### 1.1 User Login
- **Endpoint**: `POST /api/auth/login`
- **Access**: Public
- **Request Body**:
```json
{
  "loginIdentifier": "23010101",
  "password": "studentPassword123"
}
```
- **Response `200 OK`**:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "671234567890abcdef123456",
    "name": "Het Patel",
    "enrollmentNumber": "23010101",
    "email": "het@sou.edu",
    "role": "student",
    "course": "MCA",
    "semester": 3
  }
}
```

---

## 2. Examination & Submission Endpoints (`/api/exams`)

### 2.1 Get Student's Permitted Exams
- **Endpoint**: `GET /api/exams?semester=3&course=MCA`
- **Access**: Student (Authenticated)
- **Response `200 OK`**: Returns array of active/scheduled exams matching the student's program and semester.

### 2.2 Submit Practical Coding Exam
- **Endpoint**: `POST /api/exams/:examId/submit`
- **Access**: Student (Authenticated)
- **Request Body**:
```json
{
  "answers": [
    {
      "questionId": "671a1234567890abcdef1234",
      "answer": "function factorial(num) {\n  if (num < 0) return 'Undefined';\n  let result = 1;\n  for (let i = 2; i <= num; i++) result *= i;\n  return result;\n}\nconsole.log(factorial(5));",
      "language": "javascript"
    }
  ]
}
```
- **Response `200 OK`**:
```json
{
  "message": "Exam submitted successfully",
  "submission": {
    "score": 45,
    "totalMarks": 45,
    "correctnessScore": 100,
    "qualityScore": 100,
    "status": "evaluated",
    "executionTime": 120,
    "memoryUsed": "14.2 MB",
    "passed": true,
    "questionScores": [
      {
        "questionId": "671a1234567890abcdef1234",
        "score": 45,
        "maxMarks": 45,
        "codeBreakdown": [
          {
            "component": "Boundary & Edge Case Condition",
            "codeSnippet": "if (num < 0) return 'Undefined';",
            "maxMarks": 22,
            "awardedMarks": 22,
            "status": "correct",
            "comment": "Accurately handles negative numbers"
          },
          {
            "component": "Core Computation Loop",
            "codeSnippet": "for (let i = 2; i <= num; i++) result *= i;",
            "maxMarks": 23,
            "awardedMarks": 23,
            "status": "correct",
            "comment": "Accurately implements iterative factorial logic"
          }
        ],
        "annotatedCode": "45 marks for function factorial(num) {\n  22 marks for condition: if (num < 0) return 'Undefined';\n  let result = 1;\n  23 marks for loop: for (let i = 2; i <= num; i++) result *= i;\n  return result;\n}\nconsole.log(factorial(5)); // 120"
      }
    ]
  }
}
```

### 2.3 Record Proctoring Disqualification
- **Endpoint**: `POST /api/exams/:examId/disqualify`
- **Access**: Student (Automated by Proctoring Guard)
- **Request Body**:
```json
{
  "reason": "Exceeded 3 tab-switch / window-blur violations"
}
```
- **Response `200 OK`**:
```json
{
  "message": "Student has been disqualified",
  "submission": {
    "score": 0,
    "status": "disqualified",
    "disqualificationReason": "Exceeded 3 tab-switch / window-blur violations"
  }
}
```

---

## 3. Faculty / Admin Endpoints (`/api/admin`)

### 3.1 Schedule Examination
- **Endpoint**: `POST /api/admin/exams`
- **Access**: Faculty / Admin
- **Request Body**:
```json
{
  "subjectId": "6710abcd1234567890123456",
  "date": "2026-11-15",
  "time": "10:30",
  "duration": 90,
  "semester": 3,
  "course": "MCA",
  "examType": "practical",
  "evaluationMethod": "ai",
  "evaluationStrictness": "medium",
  "resultDate": "2026-11-16T18:00:00.000Z",
  "totalMarks": 100,
  "totalQuestions": 5,
  "questionsPerStudent": 3
}
```

### 3.2 Fetch Submissions for Grading Review
- **Endpoint**: `GET /api/admin/exams/:examId/submissions`
- **Access**: Faculty / Admin
- **Response `200 OK`**: Returns all student submissions with AI breakdowns, outputs, and student telemetry.
