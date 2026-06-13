import JSZip from 'jszip';
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
  const parsed = Papa.parse<RenameCsvRow>(csv.replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true
  });
  const errors = parsed.errors.map((error) => `CSV 解析失败：${error.message}`);
  const rows = parsed.data.filter((row) => row.old_filename);

  return parseRenameRows(rows, expectedOldFilenames, errors);
}

export async function parseRenameXlsx(
  workbookBuffer: ArrayBuffer,
  expectedOldFilenames: string[]
): Promise<ParseRenameResult> {
  try {
    const zip = await JSZip.loadAsync(workbookBuffer);
    const worksheetPath = await findFirstWorksheetPath(zip);
    const worksheetXml = await readZipText(zip, worksheetPath);
    const sharedStrings = await readSharedStrings(zip);
    const rows = readWorksheetRows(worksheetXml, sharedStrings);
    const renameRows = rowsToRenameRows(rows);

    if (renameRows.errors.length > 0) {
      return {
        errors: renameRows.errors,
        mappings: buildEmptyMappings(expectedOldFilenames)
      };
    }

    return parseRenameRows(renameRows.rows, expectedOldFilenames, []);
  } catch (error) {
    return {
      errors: [`XLSX 解析失败：${getErrorMessage(error)}`],
      mappings: buildEmptyMappings(expectedOldFilenames)
    };
  }
}

function parseRenameRows(
  rows: RenameCsvRow[],
  expectedOldFilenames: string[],
  initialErrors: string[]
): ParseRenameResult {
  const errors = [...initialErrors];
  const expected = new Set(expectedOldFilenames);
  const rowsByOldFilename = new Map<string, RenameCsvRow>();
  const seenNewNames = new Set<string>();
  const duplicateNewNames = new Set<string>();

  for (const row of rows) {
    const oldFilename = row.old_filename?.trim() ?? '';
    const newFilename = row.new_filename?.trim() ?? '';

    if (!expected.has(oldFilename)) {
      errors.push(`表格中的旧文件名无法匹配：${oldFilename}`);
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

async function findFirstWorksheetPath(zip: JSZip): Promise<string> {
  const workbookXml = await readZipText(zip, 'xl/workbook.xml');
  const workbook = parseXml(workbookXml);
  const firstSheet = workbook.getElementsByTagName('sheet')[0];
  const relationshipId = firstSheet?.getAttribute('r:id');

  if (!relationshipId) {
    return 'xl/worksheets/sheet1.xml';
  }

  const relationshipsXml = await readZipText(zip, 'xl/_rels/workbook.xml.rels');
  const relationships = parseXml(relationshipsXml);
  const relationship = Array.from(relationships.getElementsByTagName('Relationship')).find(
    (node) => node.getAttribute('Id') === relationshipId
  );
  const target = relationship?.getAttribute('Target');

  if (!target) {
    return 'xl/worksheets/sheet1.xml';
  }

  if (target.startsWith('/')) {
    return target.slice(1);
  }

  return target.startsWith('xl/') ? target : `xl/${target}`;
}

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const file = zip.file('xl/sharedStrings.xml');
  if (!file) {
    return [];
  }

  const document = parseXml(await file.async('text'));
  return Array.from(document.getElementsByTagName('si')).map((item) =>
    Array.from(item.getElementsByTagName('t'))
      .map((textNode) => textNode.textContent ?? '')
      .join('')
  );
}

function readWorksheetRows(worksheetXml: string, sharedStrings: string[]): string[][] {
  const document = parseXml(worksheetXml);
  const rows: string[][] = [];

  for (const rowNode of Array.from(document.getElementsByTagName('row'))) {
    const rowIndex = Math.max(0, Number(rowNode.getAttribute('r') ?? rows.length + 1) - 1);
    const row = rows[rowIndex] ?? [];

    for (const cellNode of Array.from(rowNode.getElementsByTagName('c'))) {
      const cellReference = cellNode.getAttribute('r') ?? '';
      const columnIndex = getColumnIndex(cellReference) ?? row.length;
      row[columnIndex] = readCellValue(cellNode, sharedStrings);
    }

    rows[rowIndex] = row;
  }

  return rows.filter((row) => row.some((cell) => cell.trim()));
}

function rowsToRenameRows(rows: string[][]): { rows: RenameCsvRow[]; errors: string[] } {
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow?.map((cell) => cell.trim()) ?? [];
  const indexColumn = headers.indexOf('index');
  const oldFilenameColumn = headers.indexOf('old_filename');
  const newFilenameColumn = headers.indexOf('new_filename');
  const errors: string[] = [];

  if (oldFilenameColumn === -1) {
    errors.push('XLSX 缺少 old_filename 列');
  }
  if (newFilenameColumn === -1) {
    errors.push('XLSX 缺少 new_filename 列');
  }
  if (errors.length > 0) {
    return { errors, rows: [] };
  }

  return {
    errors: [],
    rows: dataRows
      .map((row) => ({
        index: indexColumn === -1 ? '' : row[indexColumn] ?? '',
        old_filename: row[oldFilenameColumn] ?? '',
        new_filename: row[newFilenameColumn] ?? ''
      }))
      .filter((row) => row.old_filename.trim())
  };
}

function readCellValue(cellNode: Element, sharedStrings: string[]): string {
  const type = cellNode.getAttribute('t');
  if (type === 'inlineStr') {
    return Array.from(cellNode.getElementsByTagName('t'))
      .map((textNode) => textNode.textContent ?? '')
      .join('');
  }

  const value = cellNode.getElementsByTagName('v')[0]?.textContent ?? '';
  if (type === 's') {
    return sharedStrings[Number(value)] ?? '';
  }

  return value;
}

function getColumnIndex(cellReference: string): number | undefined {
  const columnName = cellReference.match(/^[A-Z]+/i)?.[0].toUpperCase();
  if (!columnName) {
    return undefined;
  }

  let index = 0;
  for (const character of columnName) {
    index = index * 26 + character.charCodeAt(0) - 64;
  }
  return index - 1;
}

async function readZipText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) {
    throw new Error(`找不到 ${path}`);
  }
  return file.async('text');
}

function parseXml(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const parserError = document.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error(parserError.textContent ?? 'XML 解析失败');
  }
  return document;
}

function buildEmptyMappings(expectedOldFilenames: string[]): RenameMapping[] {
  return expectedOldFilenames.map((oldFilename) => ({
    oldFilename,
    newFilename: '',
    status: 'valid'
  }));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
