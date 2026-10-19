const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const EXAMS_FILE = path.join(DATA_DIR, 'exams.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(EXAMS_FILE)) fs.writeFileSync(EXAMS_FILE, '{}');
if (!fs.existsSync(RESULTS_FILE)) fs.writeFileSync(RESULTS_FILE, '{}');

function loadJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

app.post('/api/exams', (req, res) => {
  const { title, time, questions, pdf } = req.body;
  if (!title || !questions || questions.length === 0) {
    return res.status(400).json({ error: 'Thiếu thông tin đề' });
  }
  const id = generateId();
  const exams = loadJSON(EXAMS_FILE);
  exams[id] = { id, title, time: time || 15, questions, pdf: pdf || null, createdAt: new Date().toISOString() };
  saveJSON(EXAMS_FILE, exams);
  res.json({ id, link: `/exam/${id}` });
});

app.get('/api/exams/:id', (req, res) => {
  const exams = loadJSON(EXAMS_FILE);
  const exam = exams[req.params.id];
  if (!exam) return res.status(404).json({ error: 'Không tìm thấy đề' });
  const safeExam = {
    ...exam,
    questions: exam.questions.map(q => ({ type: q.type, text: q.text, options: q.options }))
  };
  res.json(safeExam);
});

app.post('/api/submit', (req, res) => {
  const { examId, studentName, answers, timeTaken } = req.body;
  if (!examId || !studentName) return res.status(400).json({ error: 'Thiếu thông tin' });
  const exams = loadJSON(EXAMS_FILE);
  const exam = exams[examId];
  if (!exam) return res.status(404).json({ error: 'Không tìm thấy đề' });

  let correct = 0;
  exam.questions.forEach((q, idx) => {
    const ans = answers[idx];
    if (q.type === 'mcq' && ans === q.correct) correct++;
    if (q.type === 'tf' && ans === q.trueFalse) correct++;
  });

  const results = loadJSON(RESULTS_FILE);
  if (!results[examId]) results[examId] = [];

  const previousAttempts = results[examId].filter(r =>
    r.studentName.toLowerCase().trim() === studentName.toLowerCase().trim()
  ).length;

  const result = {
    id: generateId(),
    studentName: studentName.trim(),
    score: correct,
    total: exam.questions.length,
    percentage: Math.round((correct / exam.questions.length) * 100),
    timeTaken: timeTaken || 0,
    attempt: previousAttempts + 1,
    answers,
    submittedAt: new Date().toISOString()
  };

  results[examId].push(result);
  saveJSON(RESULTS_FILE, results);
  res.json({ success: true, score: correct, total: exam.questions.length, attempt: result.attempt });
});

app.get('/api/results/:examId', (req, res) => {
  const results = loadJSON(RESULTS_FILE);
  const examResults = results[req.params.examId] || [];
  examResults.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(examResults);
});

app.get('/api/exams', (req, res) => {
  const exams = loadJSON(EXAMS_FILE);
  const list = Object.values(exams).map(e => ({
    id: e.id, title: e.title, time: e.time,
    questionCount: e.questions.length, createdAt: e.createdAt
  }));
  res.json(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/exam/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/teacher', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});
