// ============================================================
// RECEIPT PARSER
// Takes raw OCR text from a receipt and extracts useful fields.
// Heuristic-based — NOT AI.
// ============================================================

export function parseReceipt(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { title: "", amount: null, date: null, confidence: {} };
  }

  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const title = extractTitle(lines);
  const amount = extractAmount(rawText, lines);
  const date = extractDate(rawText);

  return {
    title,
    amount,
    date,
    confidence: {
      title: title ? "high" : "low",
      amount: amount !== null ? "high" : "low",
      date: date ? "high" : "low",
    },
  };
}

// ------------------------------------------------------------
// TITLE — usually the merchant name, printed at the top
// ------------------------------------------------------------
function extractTitle(lines) {
  const skipWords = [
    "receipt", "invoice", "bill", "tax invoice", "gst",
    "date", "time", "cash memo", "customer copy",
    "thank you", "welcome", "duplicate",
  ];

  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (line.length < 3) continue;
    if (/^[\d\s\-\(\)]+$/.test(line)) continue;
    if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(line)) continue;
    if (skipWords.some((w) => lower.includes(w))) continue;
    if (/^(gst|tin|cin|phone|tel|mob|addr|www)/i.test(lower)) continue;
    if ((line.match(/[^\w\s&',.\-]/g) || []).length > 3) continue;

    return line
      .replace(/[|_~`]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 60);
  }

  return "";
}

// ------------------------------------------------------------
// AMOUNT — find the total
// ------------------------------------------------------------
function extractAmount(rawText, lines) {
  const moneyRegex =
    /(?:₹|rs\.?|inr|\$|€|£)?\s*([0-9][0-9,]*\.?[0-9]{0,2})/gi;

  const totalKeywords = [
    "grand total",
    "total amount",
    "amount due",
    "net payable",
    "net amount",
    "total payable",
    "total",
  ];

  for (const keyword of totalKeywords) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].toLowerCase();
      if (line.includes(keyword)) {
        const amounts = extractNumbersFromLine(lines[i]);
        if (amounts.length > 0) return Math.max(...amounts);
      }
    }
  }

  const allAmounts = [];
  const matches = rawText.matchAll(moneyRegex);
  for (const m of matches) {
    const n = parseAmount(m[1]);
    if (n !== null && n > 0 && n < 1_000_000) allAmounts.push(n);
  }

  if (allAmounts.length > 0) return Math.max(...allAmounts);
  return null;
}

function extractNumbersFromLine(line) {
  const numbers = [];
  const matches = line.matchAll(/([0-9][0-9,]*\.?[0-9]{0,2})/g);
  for (const m of matches) {
    const n = parseAmount(m[1]);
    if (n !== null && n > 0 && n < 1_000_000) numbers.push(n);
  }
  return numbers;
}

function parseAmount(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/,/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ------------------------------------------------------------
// DATE
// ------------------------------------------------------------
function extractDate(rawText) {
  const now = new Date();
  const minYear = now.getFullYear() - 5;

  // YYYY-MM-DD
  let m = rawText.match(/\b(20\d{2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/);
  if (m) {
    const y = parseInt(m[1]);
    const mo = parseInt(m[2]);
    const d = parseInt(m[3]);
    if (isValidDate(y, mo, d, minYear)) return toDateInput(y, mo, d);
  }

  // DD/MM/YYYY or MM/DD/YYYY
  m = rawText.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](20\d{2}|\d{2})\b/);
  if (m) {
    let a = parseInt(m[1]);
    let b = parseInt(m[2]);
    let y = parseInt(m[3]);
    if (y < 100) y += 2000;

    let day, month;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      day = b;
      month = a;
    } else {
      day = a;
      month = b;
    }

    if (isValidDate(y, month, day, minYear)) return toDateInput(y, month, day);
  }

  // DD-MM-YY
  m = rawText.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})\b/);
  if (m) {
    let a = parseInt(m[1]);
    let b = parseInt(m[2]);
    let y = parseInt(m[3]) + 2000;

    let day = a > 12 ? a : b > 12 ? b : a;
    let month = a > 12 ? b : b > 12 ? a : b;

    if (isValidDate(y, month, day, minYear)) return toDateInput(y, month, day);
  }

  const monthNames = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };

  m = rawText.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (m) {
    const day = parseInt(m[1]);
    const month = monthNames[m[2].toLowerCase()];
    const y = parseInt(m[3]);
    if (month && isValidDate(y, month, day, minYear))
      return toDateInput(y, month, day);
  }

  m = rawText.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m) {
    const month = monthNames[m[1].toLowerCase()];
    const day = parseInt(m[2]);
    const y = parseInt(m[3]);
    if (month && isValidDate(y, month, day, minYear))
      return toDateInput(y, month, day);
  }

  return null;
}

function isValidDate(y, m, d, minYear) {
  if (!y || !m || !d) return false;
  if (y < minYear) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y) return false;
  if (dt.getMonth() !== m - 1) return false;
  if (dt.getDate() !== d) return false;
  if (dt > new Date()) return false;

  return true;
}

function toDateInput(y, m, d) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}