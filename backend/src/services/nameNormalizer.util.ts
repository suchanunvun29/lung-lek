// Shared name-normalization functions used everywhere a raw Excel name (hospital or
// salesperson) needs to be compared against an existing record. Defined once here per
// design.md's Import Rules — never re-implemented in import.service.ts or anywhere else.

const THAI_OR_DIGIT_REGEX = /[฀-๿0-9]/g;
const LATIN_OR_DIGIT_REGEX = /[A-Za-z0-9]/g;
const LETTER_WORD_REGEX = /[A-Za-z]+/g;

// Longest-first so a prefix like "โรงพยาบาลส่งเสริมสุขภาพตำบล" is stripped whole rather than
// leaving "โรงพยาบาล" behind to be stripped again on the next loop iteration.
const THAI_HOSPITAL_PREFIXES = ["โรงพยาบาลส่งเสริมสุขภาพตำบล", "รพสต", "โรงพยาบาล", "รพ"];

const PERSON_TITLE_WORDS = new Set(["MR", "MRS", "MISS", "MS", "DR", "KHUN", "K"]);

// ค่าดิบในคอลัมน์ Salesman ที่แทนคนมากกว่า 1 คนจะคั่นด้วยตัวใดตัวหนึ่งในนี้ (design.md Import Rules)
const SHARED_SALESMAN_DELIMITER_REGEX = /\s*(?:\/|&|\+|,|และ)\s*/g;

/**
 * เก็บเฉพาะอักษรไทยและตัวเลข ทิ้งอย่างอื่นทั้งหมด แล้วตัดคำนำหน้าโรงพยาบาลออกจากหัวสตริงจนหมด.
 * เก็บเฉพาะอักษรไทยแทนการ "ตัดวงเล็บ" ด้วย regex เป็นเรื่องตั้งใจ — ข้อมูลจริงมีวงเล็บที่ไม่ปิด
 * และวงเล็บเต็มความกว้าง/ครึ่งความกว้างปนกัน (design.md Import Rules)
 */
export function thaiCore(input: string): string {
  let result = (input.match(THAI_OR_DIGIT_REGEX) ?? []).join("");
  let strippedSomething = true;
  while (strippedSomething) {
    strippedSomething = false;
    for (const prefix of THAI_HOSPITAL_PREFIXES) {
      if (result.startsWith(prefix)) {
        result = result.slice(prefix.length);
        strippedSomething = true;
      }
    }
  }
  return result;
}

/** เก็บเฉพาะ A-Z0-9 แล้วแปลงเป็นตัวพิมพ์ใหญ่ — ใช้เทียบส่วนชื่ออังกฤษ/ชื่อสาขา */
export function latinCore(input: string): string {
  return (input.match(LATIN_OR_DIGIT_REGEX) ?? []).join("").toUpperCase();
}

/** ตัดคำนำหน้าชื่อ (Mr/Mrs/Miss/Ms/Dr/K/Khun), ตัดอักขระที่ไม่ใช่ตัวอักษร, ต่อกันเป็นตัวพิมพ์ใหญ่ */
export function personCore(input: string): string {
  const words = input.match(LETTER_WORD_REGEX) ?? [];
  if (words.length === 0) return "";
  const startIndex = PERSON_TITLE_WORDS.has((words[0] ?? "").toUpperCase()) ? 1 : 0;
  return words
    .slice(startIndex)
    .map((w) => w.toUpperCase())
    .join("");
}

/**
 * แยกค่าดิบคอลัมน์ Salesman ที่อาจแทนคนมากกว่า 1 คน (คั่นด้วย `/ & + , และ`) เป็นรายชื่อย่อย
 * ที่ trim แล้วและไม่มีค่าว่าง คืนค่ารายการเดียวถ้าไม่มีตัวคั่นเลย
 */
export function splitSharedSalesmanNames(raw: string): string[] {
  return raw
    .split(SHARED_SALESMAN_DELIMITER_REGEX)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/** normalizedRaw ที่ใช้เป็นคีย์ unique ของ SalesmanNameRule — ยุบค่าดิบทั้งก้อนด้วย personCore ต่อคน */
export function normalizeSharedSalesmanRaw(rawNames: string[]): string {
  return rawNames.map(personCore).join("/");
}
