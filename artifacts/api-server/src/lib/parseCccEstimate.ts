import { createRequire } from "module";
import { fileURLToPath } from "url";

// pdfjs-dist must use its actual worker file — empty string fails
const _require = createRequire(import.meta.url);
let _pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;

async function getPdfjs() {
  if (_pdfjs) return _pdfjs;
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Resolve worker path from the same package location pdfjs resolves from
  const workerPath = _require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  mod.GlobalWorkerOptions.workerSrc = workerPath;
  _pdfjs = mod;
  return mod;
}

interface RawTextItem {
  str: string;
  transform: number[]; // [scaleX, skewX, skewY, scaleY, tx, ty]
  width?: number;
}

/**
 * Extract all pages as a single string, preserving columnar layout.
 * Items on the same Y-position with a horizontal gap > 10 PDF units
 * get two spaces between them — matching CCC ONE's columnar structure
 * so downstream code can split on /\s{2,}/ to separate columns.
 */
async function extractText(buffer: Buffer): Promise<string> {
  const lib = await getPdfjs();
  const uint8Array = new Uint8Array(buffer);
  const task = lib.getDocument({
    data: uint8Array,
    disableAutoFetch: true,
    disableStream: true,
  });
  const pdf = await task.promise;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group items by Y, bucketed to a 2-unit grid (avoids near-same-row splits)
    const lineMap = new Map<number, Array<{ x: number; str: string; width: number }>>();
    for (const raw of content.items as RawTextItem[]) {
      if (!raw.str?.trim()) continue;
      const y = Math.round(raw.transform[5] / 2) * 2;
      const x = raw.transform[4];
      const w = raw.width ?? raw.str.length * 5;
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x, str: raw.str, width: w });
    }

    // Top-to-bottom (PDF Y is bottom-up → sort descending)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const lines = sortedYs.map((y) => {
      const items = lineMap.get(y)!.sort((a, b) => a.x - b.x);
      let result = "";
      for (let i = 0; i < items.length; i++) {
        if (i === 0) { result = items[i].str; continue; }
        const prev = items[i - 1];
        const gap = items[i].x - (prev.x + prev.width);
        // Gap > 10 PDF units → separate columns → two spaces
        result += (gap > 10 ? "  " : gap > 1 ? " " : "") + items[i].str;
      }
      return result;
    });

    pageTexts.push(lines.join("\n"));
  }

  return pageTexts.join("\n");
}

function grab(text: string, pattern: RegExp, group = 1): string | null {
  const m = text.match(pattern);
  return m ? (m[group] ?? "").trim() || null : null;
}

function grabNum(text: string, pattern: RegExp, group = 1): number | null {
  const v = grab(text, pattern, group);
  if (!v) return null;
  const n = parseFloat(v.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

export interface ParsedLineItem {
  lineNumber: number;
  operation: string | null;
  description: string;
  partNumber: string | null;
  quantity: number | null;
  price: number | null;
  laborHours: number | null;
  paintHours: number | null;
}

export interface ParsedEstimate {
  workfileId: string | null;
  jobNumber: string | null;
  estimateDate: string | null;
  estimator: string | null;
  customerName: string | null;
  phone: string | null;
  insuredName: string | null;
  insuranceCompany: string | null;
  claimNumber: string | null;
  policyNumber: string | null;
  dateOfLoss: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  color: string | null;
  mileage: string | null;
  partsSubtotal: number | null;
  bodyLaborHours: number | null;
  bodyLaborCost: number | null;
  paintLaborHours: number | null;
  paintLaborCost: number | null;
  paintSupplies: number | null;
  bodySupplies: number | null;
  miscellaneous: number | null;
  subtotal: number | null;
  tax: number | null;
  grandTotal: number | null;
  deductible: number | null;
  customerPay: number | null;
  insurancePay: number | null;
  lineItems: ParsedLineItem[];
}

/**
 * Operation codes recognized from CCC ONE estimates.
 * Order matters — longer/more-specific codes first to avoid prefix matches.
 */
const KNOWN_OPS = [
  "R&I", "R&R", "Repl", "Rpr", "Rfn", "Subl", "Sect", "O/H",
  "Blnd", "Algn", "D&R", "Add", "Incl",
] as const;

function parseLineItems(text: string): ParsedLineItem[] {
  const headerIdx = text.search(/Line\s+Oper\s+Description/i);
  const subtotalsIdx = text.search(/SUBTOTALS/i);
  if (headerIdx === -1 || subtotalsIdx === -1) return [];

  const block = text.slice(headerIdx, subtotalsIdx);
  const rawLines = block.split("\n");
  const items: ParsedLineItem[] = [];

  for (const rawLine of rawLines) {
    // Must start with a line number (1-999)
    const lineNumMatch = rawLine.match(/^\s*(\d{1,3})\s+(.*)/);
    if (!lineNumMatch) continue;
    const lineNum = parseInt(lineNumMatch[1]);
    let rest = lineNumMatch[2].trim();

    // Strip leading flags: * # N ~
    rest = rest.replace(/^[*#N~]\s+/, "").trim();

    // Extract operation code (must be at start of remaining text)
    let operation: string | null = null;
    for (const op of KNOWN_OPS) {
      const escaped = op.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = rest.match(new RegExp(`^(${escaped})\\s+`, "i"));
      if (m) {
        operation = op;
        rest = rest.slice(m[0].length).trim();
        break;
      }
    }

    // Split on two or more spaces to get columns
    // CCC ONE layout: description  partNumber  qty  price  laborHours  paintHours
    const cols = rest.split(/\s{2,}/);
    const description = (cols[0] ?? "").trim();
    if (!description) continue;

    // Skip ALL-CAPS section headers (no operation, e.g. "LIFT GATE", "REAR LAMPS")
    if (!operation && /^[A-Z][A-Z0-9\s/&]{2,}$/.test(description)) continue;

    // Parse remaining columns for part number, qty, price, hours
    let partNumber: string | null = null;
    let quantity: number | null = null;
    let price: number | null = null;
    let laborHours: number | null = null;
    let paintHours: number | null = null;

    const numQueue: number[] = [];
    let partNumFound = false;

    for (const col of cols.slice(1)) {
      // Strip trailing T / X flags (taxed/non-taxed)
      const cleaned = col.trim().replace(/\s*[TX]$/, "").trim();
      if (!cleaned) continue;

      const isDecimalNum = /^\d+\.\d+$/.test(cleaned.replace(/,/g, ""));
      const isIntegerStr = /^\d+$/.test(cleaned.replace(/,/g, ""));

      // Part number heuristic:
      //   - Alphanumeric 5+ chars with letters → definitely a part number
      //   - All-digit integer with 5+ digits → CCC part number (not a price, qty, or hours)
      //   - All-digit integer ≤ 4 digits → qty candidate, goes to numQueue
      //   - Any decimal → price/hours, goes to numQueue
      if (!partNumFound && !isDecimalNum) {
        const digitOnly = cleaned.replace(/,/g, "");
        const hasLetters = /[A-Z]/i.test(cleaned);
        const digitLen = digitOnly.replace(/[^0-9]/g, "").length;

        if ((hasLetters && /^[A-Z0-9]{4,}$/i.test(cleaned)) || (isIntegerStr && digitLen >= 5)) {
          partNumber = cleaned.replace(/,/g, "").toUpperCase();
          partNumFound = true;
          continue;
        }
      }

      const n = parseFloat(cleaned.replace(/,/g, ""));
      if (!isNaN(n)) numQueue.push(n);
    }

    // Assign numeric columns with domain knowledge:
    //   Replace/Sublet:  qty (int ≤ 99 when part present) → price (decimal) → labor → paint
    //   Repair/Blend:    labor → paint
    //   Misc add lines:  single decimal → paint hours (e.g. "Add for Clear Coat  1.4")

    if (partNumber && numQueue.length > 0) {
      const qtyIdx = numQueue.findIndex((n) => Number.isInteger(n) && n > 0 && n <= 99);
      if (qtyIdx !== -1) {
        quantity = numQueue[qtyIdx];
        numQueue.splice(qtyIdx, 1);
      }
    }

    if (["Repl", "R&R", "Subl"].includes(operation ?? "") && numQueue.length > 0) {
      price = numQueue.shift()!;
    }

    if (numQueue.length > 0) {
      laborHours = numQueue.shift()!;
    }

    if (numQueue.length > 0) {
      paintHours = numQueue.shift()!;
    }

    // Fallback: single number on a line with no part/price assigned → paint hours
    // (e.g. "Add for Clear Coat  1.4")
    if (!price && !laborHours && !paintHours && numQueue.length > 0) {
      paintHours = numQueue.shift()!;
    }

    items.push({ lineNumber: lineNum, operation, description, partNumber, quantity, price, laborHours, paintHours });
  }

  return items;
}

export async function parseCccEstimate(buffer: Buffer): Promise<ParsedEstimate> {
  const text = await extractText(buffer);

  // ── Header ────────────────────────────────────────────────────────────────
  const workfileId = grab(text, /Workfile ID:\s+(\S+)/);
  const jobNumber = grab(text, /Job Number:\s+(\S+)/);

  // Timestamp: "7/9/2026 11:33:20 AM" — take just the date portion
  const estimateDate = grab(text, /(\d{1,2}\/\d{1,2}\/\d{4})\s+\d{1,2}:\d{2}:\d{2}/);

  const estimator = grab(text, /Written By:\s+(.+?)(?:\s{2,}|\n|$)/);

  // Customer name: "Customer: Howard, Cindy  Job Number:…"
  // CCC lists as "Last, First" — normalize to "First Last"
  const customerRaw = grab(text, /Customer:\s+(.+?)(?:\s{2,}|\n|$)/);
  const customerName = customerRaw
    ? customerRaw.includes(",")
      ? customerRaw.split(",").map((s) => s.trim()).reverse().join(" ")
      : customerRaw
    : null;

  // Phone: look for (xxx) xxx-xxxx anywhere
  const phoneMatch = text.match(/\((\d{3})\)\s+([\d-]{7,12})/);
  const phone = phoneMatch ? `(${phoneMatch[1]}) ${phoneMatch[2]}` : null;

  // Insured: "Insured:  Howard, Cindy  Policy #:  …"
  const insuredRaw = grab(text, /Insured:\s+(.+?)(?:\s{2,}|\n|$)/);
  const insuredName = insuredRaw
    ? insuredRaw.includes(",")
      ? insuredRaw.split(",").map((s) => s.trim()).reverse().join(" ")
      : insuredRaw
    : null;

  // Claim/Policy must start with an alphanumeric (not another label like "Type" or "Claim")
  const claimNumber = grab(text, /Claim #:\s+([A-Z0-9][A-Z0-9\-]*)/i);
  const policyNumber = grab(text, /Policy #:\s+([A-Z0-9][A-Z0-9\-]*)/i);
  // Date of loss must be a date format
  const dateOfLoss = grab(text, /Date of Loss:\s+(\d{1,2}\/\d{1,2}\/\d{4})/);

  // Insurance company: must look like a company name — has letters, no colon on the same fragment
  // Avoid capturing the next label or personal names (which contain commas)
  const insuranceCompany =
    grab(text, /Insurance Company:\s+([A-Za-z][^,\n:]{2,}?)(?:\s{2,}|\n|$)/) ?? null;

  // ── Vehicle ───────────────────────────────────────────────────────────────
  // CCC line: "2024 GMC Acadia Elevation FWD 4D UTV 4-2.5L…"
  const vehicleMatch = text.match(/\b((?:19|20)\d{2})\s+([A-Z][a-zA-Z\-]+)\s+([A-Z][a-zA-Z]+)\s+(.+?)(?:\n|$)/);
  let year: number | null = null;
  let make: string | null = null;
  let model: string | null = null;
  let trim: string | null = null;

  if (vehicleMatch) {
    year = parseInt(vehicleMatch[1]);
    make = vehicleMatch[2];
    model = vehicleMatch[3];
    // Trim: stop at engine displacement (e.g. "4-2.5L") or body style designator digits
    const rawTrim = vehicleMatch[4].trim();
    // Take up to (but not including) the first token that is all-numeric or "nD" body code
    const trimTokens = rawTrim.split(/\s+/);
    const stopIdx = trimTokens.findIndex((t) => /^\d[A-Z]$/.test(t) || /^\d+[-]\d+\.\d+L$/i.test(t));
    trim = (stopIdx > 0 ? trimTokens.slice(0, stopIdx) : trimTokens).join(" ") || null;
  }

  // VIN: 17-char alphanumeric
  const vin = grab(text, /VIN:\s+([A-HJ-NPR-Z0-9]{17})/i);

  // Color: must be a word (letters only), not contain a colon or digit
  const color = grab(text, /Exterior Color:\s+([A-Za-z][A-Za-z\s]{1,25}?)(?:\s{2,}|\n|$)/) ?? null;

  // Mileage must be numeric digits (empty in many estimates)
  const mileage = grab(text, /Mileage In:\s+(\d[\d,]*)/);

  // ── Totals ────────────────────────────────────────────────────────────────
  // "Parts  150.00" (parts subtotal line)
  const partsSubtotal = grabNum(text, /^Parts\s+([\d,]+\.\d+)\s*$/m);

  // Body Labor: "Body Labor  5.7 hrs  @  $ 70.00 /hr  399.00"
  const bodyLaborHours = grabNum(text, /Body Labor\s+([\d.]+)\s+hrs/i);
  const bodyLaborCost = grabNum(text, /Body Labor\s+[\d.]+\s+hrs\s+@\s+\$\s*[\d.]+\s+\/hr\s+([\d,]+\.\d+)/i);

  // Paint Labor
  const paintLaborHours = grabNum(text, /Paint Labor\s+([\d.]+)\s+hrs/i);
  const paintLaborCost = grabNum(text, /Paint Labor\s+[\d.]+\s+hrs\s+@\s+\$\s*[\d.]+\s+\/hr\s+([\d,]+\.\d+)/i);

  const paintSupplies = grabNum(text, /Paint Supplies\s+[\d.]+\s+hrs\s+@\s+\$\s*[\d.]+\s+\/hr\s+([\d,]+\.\d+)/i);
  const bodySupplies = grabNum(text, /Body Supplies\s+[\d.]+\s+hrs\s+@\s+\$\s*[\d.]+\s+\/hr\s+([\d,]+\.\d+)/i);
  const miscellaneous = grabNum(text, /^Miscellaneous\s+([\d,]+\.\d+)\s*$/m);
  const subtotal = grabNum(text, /^Subtotal\s+([\d,]+\.\d+)\s*$/m);

  // Sales Tax: "Sales Tax  $ 1,238.00  @  9.0000 %  111.42" — last number on the line
  const taxMatch = text.match(/Sales Tax\s+.*?([\d,]+\.\d+)\s*(?:\n|$)/);
  const tax = taxMatch ? parseFloat(taxMatch[1].replace(/,/g, "")) : null;

  const grandTotal = grabNum(text, /^Grand Total\s+([\d,]+\.\d+)\s*$/m);
  const deductible = grabNum(text, /^Deductible\s+([\d,]+\.\d+)\s*$/m);
  const customerPay = grabNum(text, /CUSTOMER PAY\s+([\d,]+\.\d+)/i);
  const insurancePay = grabNum(text, /INSURANCE PAY\s+([\d,]+\.\d+)/i);

  // ── Line items ────────────────────────────────────────────────────────────
  const lineItems = parseLineItems(text);

  return {
    workfileId,
    jobNumber,
    estimateDate,
    estimator,
    customerName,
    phone,
    insuredName,
    insuranceCompany,
    claimNumber,
    policyNumber,
    dateOfLoss,
    year,
    make,
    model,
    trim,
    vin,
    color,
    mileage,
    partsSubtotal,
    bodyLaborHours,
    bodyLaborCost,
    paintLaborHours,
    paintLaborCost,
    paintSupplies,
    bodySupplies,
    miscellaneous,
    subtotal,
    tax,
    grandTotal,
    deductible,
    customerPay,
    insurancePay,
    lineItems,
  };
}
