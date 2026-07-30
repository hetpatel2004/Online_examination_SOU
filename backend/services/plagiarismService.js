const Submission = require('../models/Submission');
const Question = require('../models/Question');

function normalizeCode(code) {
  return code
    .replace(/\/\/.*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/["'`][^"'`]*["'`]/g, '"STR"')
    .replace(/\b\d+\b/g, '0')
    .trim()
    .toLowerCase();
}

function getNgrams(text, n = 3) {
  const ngrams = new Map();
  for (let i = 0; i <= text.length - n; i++) {
    const gram = text.substring(i, i + n);
    ngrams.set(gram, (ngrams.get(gram) || 0) + 1);
  }
  return ngrams;
}

function cosineSimilarity(vecA, vecB) {
  const keys = new Set([...vecA.keys(), ...vecB.keys()]);
  let dotProduct = 0, magA = 0, magB = 0;
  for (const key of keys) {
    const aVal = vecA.get(key) || 0;
    const bVal = vecB.get(key) || 0;
    dotProduct += aVal * bVal;
    magA += aVal * aVal;
    magB += bVal * bVal;
  }
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

function levenshteinSimilarity(a, b) {
  if (a.length === 0) return b.length === 0 ? 1 : 0;
  if (b.length === 0) return 0;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - matrix[b.length][a.length] / maxLen;
}

function calculateSimilarity(codeA, codeB, options = {}) {
  const threshold = options.threshold || 0.05;
  const normA = normalizeCode(codeA);
  const normB = normalizeCode(codeB);

  if (!normA || !normB) return { overall: 0, ngram: 0, levenshtein: 0, normalized: '' };

  const ngramA = getNgrams(normA, 4);
  const ngramB = getNgrams(normB, 4);
  const ngramScore = cosineSimilarity(ngramA, ngramB);

  const levScore = levenshteinSimilarity(normA, normB);

  const overall = Math.round((ngramScore * 0.6 + levScore * 0.4) * 100);

  return {
    overall,
    ngram: Math.round(ngramScore * 100),
    levenshtein: Math.round(levScore * 100),
    flagged: overall > 70
  };
}

async function generatePlagiarismReport(examId) {
  try {
    const submissions = await Submission.find({
      examId,
      'submittedCode': { $exists: true, $not: { $size: 0 } }
    }).populate('studentId', 'name enrollmentNumber');

    if (!submissions.length || submissions.length < 2) {
      return { pairs: [], summary: { total: submissions.length, message: submissions.length < 2 ? 'Need at least 2 submissions for comparison' : 'No code submissions found' } };
    }

    const pairs = [];
    const allScores = [];

    for (let i = 0; i < submissions.length; i++) {
      for (let j = i + 1; j < submissions.length; j++) {
        const subA = submissions[i];
        const subB = submissions[j];

        if (!subA.submittedCode || !subA.submittedCode.length || !subB.submittedCode || !subB.submittedCode.length) continue;

        let maxScore = 0;
        let matchedQuestion = null;
        let answerA = '', answerB = '';

        for (const codeA of subA.submittedCode) {
          for (const codeB of subB.submittedCode) {
            if (codeA.questionId && codeB.questionId && codeA.questionId.toString() !== codeB.questionId.toString()) continue;
            const result = calculateSimilarity(codeA.code || '', codeB.code || '');
            if (result.overall > maxScore) {
              maxScore = result.overall;
              matchedQuestion = codeA.questionId;
              answerA = codeA.code || '';
              answerB = codeB.code || '';
            }
          }
        }

        if (maxScore > 0) {
          allScores.push(maxScore);
          pairs.push({
            studentA: { id: subA.studentId?._id, name: subA.studentId?.name, enrollment: subA.studentId?.enrollmentNumber },
            studentB: { id: subB.studentId?._id, name: subB.studentId?.name, enrollment: subB.studentId?.enrollmentNumber },
            similarity: maxScore,
            flagged: maxScore > 70,
            matchedQuestion,
            snippets: {
              fromA: answerA.substring(0, 200),
              fromB: answerB.substring(0, 200)
            }
          });
        }
      }
    }

    const flaggedCount = pairs.filter(p => p.flagged).length;
    const avgSimilarity = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;

    pairs.sort((a, b) => b.similarity - a.similarity);

    return {
      pairs: pairs.slice(0, 50),
      summary: {
        total: submissions.length,
        comparisons: pairs.length,
        flagged: flaggedCount,
        averageSimilarity: avgSimilarity,
        maxSimilarity: allScores.length ? Math.max(...allScores) : 0,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (err) {
    console.error('[PLAGIARISM] Report error:', err.message);
    throw err;
  }
}

async function checkPair(studentAId, studentBId, examId) {
  try {
    const submissions = await Submission.find({
      examId,
      studentId: { $in: [studentAId, studentBId] }
    }).populate('studentId', 'name enrollmentNumber');

    if (!submissions || submissions.length !== 2) {
      return { error: 'Both students must have submitted this exam' };
    }

    const [subA, subB] = submissions;
    let maxScore = 0;
    let matchedQuestion = null;

    for (const codeA of (subA.submittedCode || [])) {
      for (const codeB of (subB.submittedCode || [])) {
        const result = calculateSimilarity(codeA.code || '', codeB.code || '');
        if (result.overall > maxScore) {
          maxScore = result.overall;
          matchedQuestion = codeA.questionId;
        }
      }
    }

    return {
      studentA: { id: subA.studentId?._id, name: subA.studentId?.name, enrollment: subA.studentId?.enrollmentNumber },
      studentB: { id: subB.studentId?._id, name: subB.studentId?.name, enrollment: subB.studentId?.enrollmentNumber },
      similarity: maxScore,
      flagged: maxScore > 70,
      matchedQuestion
    };
  } catch (err) {
    console.error('[PLAGIARISM] Pair check error:', err.message);
    throw err;
  }
}

module.exports = { generatePlagiarismReport, checkPair, calculateSimilarity };
