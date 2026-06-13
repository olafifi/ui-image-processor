import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildRenameCsv, parseRenameCsv, parseRenameXlsx } from './csvRename';

describe('csv rename workflow', () => {
  it('builds a utf8 bom csv template', () => {
    const csv = buildRenameCsv(['hero_ref_01.webp']);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('index,old_filename,new_filename');
    expect(csv).toContain('1,hero_ref_01.webp,');
  });

  it('parses new filenames by old filename', () => {
    const result = parseRenameCsv(
      'index,old_filename,new_filename\n1,hero_ref_01.webp,ui_button_start\n',
      ['hero_ref_01.webp']
    );

    expect(result.mappings[0].newFilename).toBe('ui_button_start');
    expect(result.errors).toEqual([]);
  });

  it('reports duplicate new filenames', () => {
    const result = parseRenameCsv(
      'index,old_filename,new_filename\n1,a.webp,ui_same\n2,b.png,ui_same\n',
      ['a.webp', 'b.png']
    );

    expect(result.errors).toContain('新文件名重复：ui_same');
  });

  it('reports illegal filename characters', () => {
    const result = parseRenameCsv('index,old_filename,new_filename\n1,a.webp,bad/name\n', ['a.webp']);

    expect(result.errors).toContain('新文件名包含非法字符：bad/name');
  });

  it('parses rename mappings from a wps xlsx workbook', async () => {
    const workbook = await buildMinimalRenameWorkbook([
      ['index', 'old_filename', 'new_filename'],
      ['1', 'a.webp', 'ui_cat_surprised'],
      ['2', 'b.png', 'ui_cat_angry']
    ]);

    const result = await parseRenameXlsx(workbook, ['a.webp', 'b.png']);

    expect(result.errors).toEqual([]);
    expect(result.mappings).toEqual([
      { oldFilename: 'a.webp', newFilename: 'ui_cat_surprised', status: 'valid' },
      { oldFilename: 'b.png', newFilename: 'ui_cat_angry', status: 'valid' }
    ]);
  });
});

async function buildMinimalRenameWorkbook(rows: string[][]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const sharedStrings = rows.flat();
  const sharedStringXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map((value) => `<si><t>${escapeXml(value)}</t></si>`).join('')}
</sst>`;
  let sharedStringIndex = 0;
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((_, columnIndex) => {
          const cell = `${columnName(columnIndex)}${rowIndex + 1}`;
          return `<c r="${cell}" t="s"><v>${sharedStringIndex++}</v></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types" />'
  );
  zip.file(
    'xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
  );
  zip.file('xl/sharedStrings.xml', sharedStringXml);
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`
  );

  return zip.generateAsync({ type: 'arraybuffer' });
}

function columnName(index: number): string {
  let name = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - remainder) / 26);
  }
  return name;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
