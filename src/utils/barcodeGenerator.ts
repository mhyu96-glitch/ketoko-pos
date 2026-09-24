/**
 * Simple Code 128 (Subset B) SVG Barcode Generator
 * 100% Client-side, zero dependencies, offline compatible
 */

const CODE128_PATTERNS: number[] = [
  212222, 222122, 222221, 121223, 121322, 131222, 122213, 122312, 132212, 221213, // 0-9
  221312, 231212, 112232, 122132, 122231, 113222, 123122, 123221, 223211, 221132, // 10-19
  221231, 213212, 223112, 312131, 311222, 321122, 321221, 312212, 322112, 322211, // 20-29
  212123, 212321, 232121, 111323, 131123, 131321, 112313, 132113, 132311, 211313, // 30-39
  231113, 231311, 112133, 112331, 132131, 113123, 113321, 133121, 313121, 211331, // 40-49
  231131, 213113, 213311, 213131, 311123, 311321, 331121, 312113, 312311, 332111, // 50-59
  314111, 221411, 431111, 111224, 111422, 121124, 121421, 141122, 141221, 112214, // 60-69
  112412, 122114, 122411, 142112, 142211, 241211, 221114, 413111, 241112, 134111, // 70-79
  111242, 121142, 121241, 114212, 124112, 124211, 411212, 421112, 421211, 212141, // 80-89
  214121, 412121, 111143, 111341, 131141, 114113, 114311, 411113, 411311, 113141, // 90-99
  114131, 311141, 411131, 211412, 211214, 211232, 2331112 // 100-106 (106 is STOP)
];

const START_B = 104;
const STOP = 106;

export function generateBarcodeSvg(code: string, height = 40, showText = false): string {
  const cleanCode = (code || '000000').trim();
  const patternIndices: number[] = [START_B];
  let checkSum = START_B;

  for (let i = 0; i < cleanCode.length; i++) {
    const charCode = cleanCode.charCodeAt(i) - 32;
    const val = Math.max(0, Math.min(charCode, 95));
    patternIndices.push(val);
    checkSum += val * (i + 1);
  }

  const checkDigit = checkSum % 103;
  patternIndices.push(checkDigit);
  patternIndices.push(STOP);

  let binaryBars = '';
  for (const idx of patternIndices) {
    const pattern = CODE128_PATTERNS[idx] || CODE128_PATTERNS[0];
    const digits = String(pattern);
    for (let d = 0; d < digits.length; d++) {
      const width = Number(digits[d]);
      const isBar = d % 2 === 0;
      binaryBars += (isBar ? '1' : '0').repeat(width);
    }
  }

  const barWidth = 1.5;
  const totalWidth = binaryBars.length * barWidth;
  let paths = '';

  for (let i = 0; i < binaryBars.length; i++) {
    if (binaryBars[i] === '1') {
      const x = i * barWidth;
      paths += `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="#000000" />`;
    }
  }

  return `
    <svg viewBox="0 0 ${totalWidth} ${height + (showText ? 14 : 0)}" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto">
      ${paths}
      ${showText ? `<text x="${totalWidth / 2}" y="${height + 11}" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#000000">${cleanCode}</text>` : ''}
    </svg>
  `.trim();
}

