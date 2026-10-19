const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const CURRENT_EXAM_FILE = path.join(DATA_DIR, 'current-exam.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const EXAM_HISTORY_FILE = path.join(DATA_DIR, 'exam-history.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(CURRENT_EXAM_FILE)) fs.writeFileSync(CURRENT_EXAM_FILE, 'null');
if (!fs.existsSync(RESULTS_FILE)) fs.writeFileSync(RESULTS_FILE, '[]');
if (!fs.existsSync(EXAM_HISTORY_FILE)) fs.writeFileSync(EXAM_HISTORY_FILE, '[]');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

function loadJSON(file, defaultVal = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return defaultVal; }
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.get('/api/current-exam', (req, res) => {
  const exam = loadJSON(CURRENT_EXAM_FILE);
  if (!exam) return res.json(null);
  res.json({
    title: exam.title,
    time: exam.time,
    maxAttempts: exam.maxAttempts || 1,
    antiCheat: !!exam.antiCheat,
    shuffle: !!exam.shuffle,
    questions: exam.questions.map(q => ({
      type: q.type,
      text: q.text,
      options: q.options
    })),
    wordHtml: exam.wordHtml || null,
    updatedAt: exam.updatedAt
  });
});

app.get('/api/teacher/current-exam', (req, res) => {
  const exam = loadJSON(CURRENT_EXAM_FILE);
  res.json(exam);
});

app.post('/api/parse-word', upload.single('wordFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Chưa chọn file' });

    const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
    const html = result.value;
    const text = html.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\n+/g, '\n').trim();

    const questions = parseQuestionsFromText(text);
    res.json({ success: true, questions, wordHtml: html, rawText: text.slice(0, 2000) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Không đọc được file Word' });
  }
});

function parseQuestionsFromText(text) {
  const questions = [];
  // Split by common question patterns: Câu 1, Câu 2, Question 1, 1., 1)
  const blocks = text.split(/(?=Câu\s*\d+|Question\s*\d+|^\d+[\.\)]\s)/im).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let qText = '';
    const options = [];
    let correct = -1;
    let isTF = false;
    let trueFalse = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Option patterns: A. B. C. D. or A) B) or 1. 2. 3. 4.
      const optMatch = line.match(/^([A-D]|[a-d])[\.\)]\s*(.+)/);
      if (optMatch) {
        options.push(optMatch[2].trim());
        continue;
      }
      // Answer patterns
      const ansMatch = line.match(/(?:Đáp án|Answer|Đáp án đúng|Chọn|Key)\s*[:\-]?\s*([A-Da-d])/i);
      if (ansMatch) {
        correct = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
        continue;
      }
      // True/False
      if (/đúng\s*\/\s*sai|true\s*\/\s*false|đúng hay sai/i.test(line)) {
        isTF = true;
      }
      const tfAns = line.match(/(?:Đáp án|Answer)\s*[:\-]?\s*(Đúng|Sai|True|False)/i);
      if (tfAns) {
        isTF = true;
        trueFalse = /đúng|true/i.test(tfAns[1]);
        continue;
      }
      // Question text (skip the "Câu X:" prefix)
      if (!qText && !optMatch) {
        qText = line.replace(/^(Câu|Question)\s*\d+[\.\:\)]\s*/i, '').trim();
      } else if (options.length === 0 && !isTF) {
        qText += ' ' + line;
      }
    }

    if (isTF && qText) {
      questions.push({
        type: 'tf',
        text: qText,
        trueFalse,
        options: []
      });
    } else if (options.length >= 2 && qText) {
      questions.push({
        type: 'mcq',
        text: qText,
        options: options.slice(0, 4),
        correct: correct >= 0 && correct < options.length ? correct : 0
      });
    }
  }
  return questions;
}
  try {
    const { title, time, maxAttempts, antiCheat, shuffle, questions } = req.body;
    const parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;

    if (!title || !parsedQuestions || parsedQuestions.length === 0) {
      return res.status(400).json({ error: 'Thiếu tên đề hoặc câu hỏi' });
    }

    let wordHtml = null;
    if (req.file) {
      const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
      wordHtml = result.value;
    }

    const exam = {
      id: Date.now().toString(36),
      title,
      time: parseInt(time) || 15,
      maxAttempts: parseInt(maxAttempts) || 1,
      antiCheat: antiCheat === 'true' || antiCheat === true,
      shuffle: shuffle === 'true' || shuffle === true,
      questions: parsedQuestions,
      wordHtml,
      updatedAt: new Date().toISOString()
    };

    const history = loadJSON(EXAM_HISTORY_FILE, []);
    const oldExam = loadJSON(CURRENT_EXAM_FILE);
    if (oldExam) history.unshift({ ...oldExam, archivedAt: new Date().toISOString() });
    saveJSON(EXAM_HISTORY_FILE, history.slice(0, 20));

    saveJSON(CURRENT_EXAM_FILE, exam);
    saveJSON(RESULTS_FILE, []);

    res.json({ success: true, message: 'Đã cập nhật đề mới' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi xử lý file' });
  }
});

app.post('/api/submit', (req, res) => {
  const { studentName, className, answers, timeTaken, exitCount } = req.body;
  if (!studentName || !className) return res.status(400).json({ error: 'Thiếu họ tên hoặc lớp' });

  const exam = loadJSON(CURRENT_EXAM_FILE);
  if (!exam) return res.status(404).json({ error: 'Chưa có đề' });

  const results = loadJSON(RESULTS_FILE, []);
  const studentKey = (studentName + '|' + className).toLowerCase().trim();
  const previousAttempts = results.filter(r =>
    (r.studentName + '|' + (r.className || '')).toLowerCase().trim() === studentKey
  ).length;

  const maxAttempts = exam.maxAttempts || 1;
  if (previousAttempts >= maxAttempts) {
    return res.status(400).json({ error: `Bạn đã làm đủ ${maxAttempts} lần cho đề này` });
  }

  let correct = 0;
  exam.questions.forEach((q, idx) => {
    const ans = answers[idx];
    if (q.type === 'mcq' && ans === q.correct) correct++;
    if (q.type === 'tf' && ans === q.trueFalse) correct++;
  });

  const result = {
    studentName: studentName.trim(),
    className: className.trim(),
    score: correct,
    total: exam.questions.length,
    percentage: Math.round((correct / exam.questions.length) * 100),
    timeTaken: timeTaken || 0,
    attempt: previousAttempts + 1,
    maxAttempts,
    exitCount: parseInt(exitCount) || 0,
    antiCheat: !!exam.antiCheat,
    submittedAt: new Date().toISOString(),
    examTitle: exam.title
  };

  results.push(result);
  saveJSON(RESULTS_FILE, results);

  res.json({ 
    success: true, 
    score: correct, 
    total: exam.questions.length, 
    attempt: result.attempt,
    maxAttempts,
    exitCount: result.exitCount
  });
});

app.get('/api/results', (req, res) => {
  const results = loadJSON(RESULTS_FILE, []);
  results.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(results);
});

app.get('/api/my-results', (req, res) => {
  const { name, className } = req.query;
  if (!name || !className) return res.json([]);
  const results = loadJSON(RESULTS_FILE, []);
  const key = (name + '|' + className).toLowerCase().trim();
  const mine = results.filter(r =>
    (r.studentName + '|' + (r.className || '')).toLowerCase().trim() === key
  );
  mine.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(mine);
});

app.get('/api/exam-history', (req, res) => {
  const history = loadJSON(EXAM_HISTORY_FILE, []);
  res.json(history);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/teacher', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});
