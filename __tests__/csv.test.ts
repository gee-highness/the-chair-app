// __tests__/csv.test.ts
import { describe, it, expect } from 'vitest';
import { csvCell, toCsv } from '@/lib/csv';

describe('csv', () => {
  it('quotes cells with commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(30)).toBe('30');
  });

  it('defuses spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+1555')).toBe("'+1555");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });

  it('builds a header row and one row per record', () => {
    const csv = toCsv([{ n: 'Ann', p: 5 }, { n: 'Bo', p: 7 }], [
      { header: 'Name', value: (r) => r.n },
      { header: 'Price', value: (r) => r.p },
    ]);
    expect(csv).toBe('Name,Price\r\nAnn,5\r\nBo,7');
  });
});
