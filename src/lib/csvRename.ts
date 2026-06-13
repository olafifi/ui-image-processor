import Papa from 'papaparse';
import type { RenameMapping } from '../types';

interface RenameCsvRow {
  index: string;
  old_filename: string;
  new_filename: string;
}

export interface ParseRenameResult {
  mappings: RenameMapping[];
  errors: string[];
}

const UTF8_BOM = '\ufeff';
const ILLEGAL_FILENAME_PATTERN = /[\\/:*?"<>|]/;

export function buildRenameCsv(oldFilenames: string[]): string {
  const rows: RenameCsvRow[] = oldFilenames.map((filename, index) => ({
    index: String(index + 1),
    old_filename: filename,
    new_filename: ''
  }));

  return UTF8_BOM + Papa.unparse(rows, { columns: ['index', 'old_filename', 'new_filename'] });
}

export function parseRenameCsv(csv: string, expectedOldFilenames: string[]): ParseRenameResult {
  const errors: string[] = [];
  const expected = new Set(expectedOldFilenames);
  const parsed = Papa.parse<RenameCsvRow>(csv.replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true
  });

  for (const error of parsed.errors) {
    errors.push(`CSV 解析失败：${error.message}`);
  }

  const rows = parsed.data.filter((row) => row.old_filename);
  const rowsByOldFilename = new Map<string, RenameCsvRow>();
  const seenNewNames = new Set<string>();
  const duplicateNewNames = new Set<string>();

  for (const row of rows) {
    const oldFilename = row.old_filename?.trim() ?? '';
    const newFilename = row.new_filename?.trim() ?? '';

    if (!expected.has(oldFilename)) {
      errors.push(`CSV 中的旧文件名无法匹配：${oldFilename}`);
      continue;
    }

    rowsByOldFilename.set(oldFilename, { ...row, new_filename: newFilename });

    if (newFilename && ILLEGAL_FILENAME_PATTERN.test(newFilename)) {
      errors.push(`新文件名包含非法字符：${newFilename}`);
    }

    if (newFilename) {
      if (seenNewNames.has(newFilename)) {
        duplicateNewNames.add(newFilename);
      }
      seenNewNames.add(newFilename);
    }
  }

  for (const duplicateName of duplicateNewNames) {
    errors.push(`新文件名重复：${duplicateName}`);
  }

  const mappings = expectedOldFilenames.map<RenameMapping>((oldFilename) => {
    const row = rowsByOldFilename.get(oldFilename);
    return {
      oldFilename,
      newFilename: row?.new_filename ?? '',
      status: 'valid'
    };
  });

  return { mappings, errors };
}
