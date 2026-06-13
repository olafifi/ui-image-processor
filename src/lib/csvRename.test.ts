import { describe, expect, it } from 'vitest';
import { buildRenameCsv, parseRenameCsv } from './csvRename';

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
});
