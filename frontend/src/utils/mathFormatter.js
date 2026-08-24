import katex from 'katex';

/**
 * Ultimate Mathematical, Scientific, Geometry & ALL FRACTIONS Engine
 * Trinetra Online Academy - TET/TAT, GPSC, Maths & Science Platform
 * 
 * Powered by KaTeX + Smart Math Auto-Parser
 * 
 * Supports:
 * - 1. Fractions: \frac{20}{25}, 4\frac{1}{5}, \frac{40x^2y+1}{4xy}, (x + \frac{1}{2})^2, 1/2, 3/4, 22/7, 7 11/12
 * - 2. Powers & Roots: x^2, a^4 - b^4, \sqrt{16}, \sqrt[3]{27}, 3a^2b, 10^5, x^-1
 * - 3. Geometry: \overline{CD} (segment), \vec{QP} (ray/vector), \overleftrightarrow{ZM} (line), \angle PQR, \Delta ABC, 90^\circ, 90^o
 * - 4. Subscripts: x_1, x_2, H_2O, CO_2, H_2SO_4
 * - 5. Logic & Relations: ±, ≠, ≤, ≥, ≈, ≡, ∝, ∞, ∴, ∵, ⇒, ⇔, ∈, ∉, ⊂, ⊆, ∪, ∩
 */

const SUPERSCRIPTS = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ',
  'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ',
  'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ',
  'T': 'ᵀ', 'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ'
};

const SUBSCRIPTS = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ˡ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ'
};

const PREDEFINED_FRACTIONS = {
  '1/2': '½',
  '1/3': '⅓', '2/3': '⅔',
  '1/4': '¼', '3/4': '¾',
  '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘',
  '1/6': '⅙', '5/6': '⅚',
  '1/7': '⅐',
  '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞',
  '1/9': '⅑',
  '1/10': '⅒'
};

/**
 * Render any LaTeX math block to HTML string safely via KaTeX
 */
export function renderKaTeX(latex, isDisplay = false) {
  try {
    return katex.renderToString(latex, {
      displayMode: isDisplay,
      throwOnError: false,
      output: 'htmlAndMathml'
    });
  } catch (err) {
    return latex;
  }
}

/**
 * Format any arbitrary fraction numbers (e.g. 22/7 -> ²²/₇)
 */
export function formatAnyFraction(numStr, denStr) {
  const n = String(numStr).trim();
  const d = String(denStr).trim();
  const key = `${n}/${d}`;
  if (PREDEFINED_FRACTIONS[key]) return PREDEFINED_FRACTIONS[key];

  if (/^[0-9]{1,3}$/.test(n) && /^[0-9]{1,3}$/.test(d)) {
    const superNum = n.split('').map(c => SUPERSCRIPTS[c] || c).join('');
    const subDen = d.split('').map(c => SUBSCRIPTS[c] || c).join('');
    return `${superNum}/${subDen}`;
  }

  return `(${n}/${d})`;
}

function cleanInnerMath(expr) {
  let l = expr.trim();
  l = l.replace(/(?<![0-9\/])(\d+)\/(\d+)(?![0-9\/])/g, '\\frac{$1}{$2}');
  l = l.replace(/\^([0-9a-zA-Z]+)/g, '^{$1}');
  l = l.replace(/\+-/g, '\\pm ');
  return l;
}

/**
 * Formats mathematical text into rich HTML with KaTeX and clean Unicode symbols
 */
export function formatMathText(rawText) {
  if (!rawText || typeof rawText !== 'string') return rawText || '';

  let text = rawText;

  // 1. Process explicit LaTeX delimited blocks: $...$ or $$...$$
  text = text.replace(/\$\$([^\$]+)\$\$/g, (_, latex) => renderKaTeX(latex.trim(), true));
  text = text.replace(/\$([^\$]+)\$/g, (_, latex) => renderKaTeX(latex.trim(), false));

  // ── AUTO-DETECT BLOCK: Smart pattern recognition for natural math writing ──

  // 1. Double Parentheses with fractions/powers: (x + 1/2)(x - 1/2)
  text = text.replace(/\(([^()]*\d+\/\d+[^()]*)\)\s*\(([^()]*\d+\/\d+[^()]*)\)/g, (_, in1, in2) => {
    return renderKaTeX('\\left(' + cleanInnerMath(in1) + '\\right)\\left(' + cleanInnerMath(in2) + '\\right)');
  });

  // 2. Parenthesized with fraction + power: (x + 1/2)^2, (2x + 1/2)^2, (x - 1/2)^2
  text = text.replace(/\(([^()]*\d+\/\d+[^()]*)\)\^([0-9a-zA-Z\+\-]+)/g, (_, inner, pow) => {
    return renderKaTeX('\\left(' + cleanInnerMath(inner) + '\\right)^{' + pow + '}');
  });

  // 3. Parenthesized with algebraic fraction / fraction: (x + 1/2) -> \left(x + \frac{1}{2}\right)
  text = text.replace(/(?<![\/])\(([^()]*\d+\/\d+[^()]*)\)(?![\/\^])/g, (_, inner) => {
    return renderKaTeX('\\left(' + cleanInnerMath(inner) + '\\right)');
  });

  // 4. Parenthesized algebraic factors with power: (x - 7)^2, (5x - 4)^2, (x^2 - 3)^2, (a + b)^2
  text = text.replace(/\(([^()]+)\)\^([0-9a-zA-Z\+\-]+)/g, (_, inner, pow) => {
    return renderKaTeX('(' + cleanInnerMath(inner) + ')^{' + pow + '}');
  });

  // 5. Parenthesized algebraic factors: (x + 7)(x - 7), (5x - 4)(5x + 4)
  text = text.replace(/\(([a-zA-Z0-9\s\+\-\*\^]+)\)\s*\(([a-zA-Z0-9\s\+\-\*\^]+)\)/g, (_, in1, in2) => {
    return renderKaTeX('(' + cleanInnerMath(in1) + ')(' + cleanInnerMath(in2) + ')');
  });

  // 1a. Trig with power: sin^2(theta), cos^2(x), tan^2(A), sec^2, cot^2, cosec^2
  //     Teacher writes: sin^2(theta)  →  auto: sin²(θ)  via KaTeX
  text = text.replace(/(sin|cos|tan|cot|sec|cosec|sinh|cosh|tanh)\^(\d+)\s*[\(\{]?([a-zA-Z\\\u03B1-\u03C9\s]*)[\)\}]?/g,
    (match, fn, pow, arg) => {
      if (!arg.trim()) return match;
      try {
        const argLatex = arg.trim()
          .replace(/\btheta\b/g, '\\theta').replace(/\balpha\b/g, '\\alpha')
          .replace(/\bbeta\b/g, '\\beta').replace(/\bgamma\b/g, '\\gamma');
        return renderKaTeX(`\\${fn}^{${pow}}(${argLatex})`, false);
      } catch { return match; }
    }
  );

  // 1b. Log with base: log_10(x), log_e(x), log_2(x), ln(x)
  //     Teacher writes: log_10 x  →  auto: log₁₀ x
  text = text.replace(/\blog_\{?(\w+)\}?\s+([a-zA-Z0-9\^\_]+)/g, (match, base, arg) => {
    try { return renderKaTeX(`\\log_{${base}} ${arg}`, false); } catch { return match; }
  });
  text = text.replace(/\blog_(\d+)\s*[\(\{]?([a-zA-Z0-9]+)[\)\}]?/g, (match, base, arg) => {
    try { return renderKaTeX(`\\log_{${base}}(${arg})`, false); } catch { return match; }
  });

  // 1c. Algebraic fraction — FULL COVERAGE:

  // Pattern A: (numerator)/(denominator) — both have parens
  //   e.g. (a+b)/(c+d), (x^2+1)/(x-1)
  text = text.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, (match, num, den) => {
    try { return renderKaTeX(`\\frac{${num.trim()}}{${den.trim()}}`, false); } catch { return match; }
  });

  // Pattern B: (numerator)/term — parens only on numerator, denominator is simple term
  //   e.g. (3x+2)/3x, (a+b)/c, (x^2-1)/2x
  text = text.replace(/\(([^()]+)\)\/([a-zA-Z0-9\^\_]+)/g, (match, num, den) => {
    try { return renderKaTeX(`\\frac{${num.trim()}}{${den.trim()}}`, false); } catch { return match; }
  });

  // Pattern C: number/variable — e.g. 2/x, 3/n, 4/xy, 1/2x
  //   (but NOT date patterns like 08/2026)
  text = text.replace(/(?<![0-9\/])(\d+)\/([a-zA-Z][a-zA-Z0-9]*)(?![0-9\/])/g, (match, num, den) => {
    try { return renderKaTeX(`\\frac{${num}}{${den}}`, false); } catch { return match; }
  });

  // Pattern D: variable/number — e.g. x/2, 3x/5, n/4
  text = text.replace(/(?<![0-9\/])([a-zA-Z][a-zA-Z0-9]*)\/(\d+)(?![0-9\/])/g, (match, num, den) => {
    try { return renderKaTeX(`\\frac{${num}}{${den}}`, false); } catch { return match; }
  });

  // 1d. sqrt with parentheses: sqrt(b^2 - 4ac) → √ rendered
  //     Teacher writes: sqrt(b^2 - 4ac) → auto sqrt
  text = text.replace(/\bsqrt\(([^()]+)\)/g, (match, inner) => {
    try { return renderKaTeX(`\\sqrt{${inner.trim()}}`, false); } catch { return match; }
  });
  text = text.replace(/\bcbrt\(([^()]+)\)/g, (match, inner) => {
    try { return renderKaTeX(`\\sqrt[3]{${inner.trim()}}`, false); } catch { return match; }
  });

  // 1e. Sigma/Sum notation: sum(i=1 to n) or sum_{i=1}^{n}
  text = text.replace(/\\sum_\{([^\}]+)\}\^\{([^\}]+)\}/g, (match, low, high) => {
    try { return renderKaTeX(`\\sum_{${low}}^{${high}}`, false); } catch { return match; }
  });

  // 1f. Limit notation: lim(x→0), lim_{x→0}
  text = text.replace(/\\lim_\{([^\}]+)\}/g, (match, cond) => {
    try { return renderKaTeX(`\\lim_{${cond}}`, false); } catch { return match; }
  });

  // 1g. Integral: \int_{0}^{1} or int_0^1
  text = text.replace(/\\?int_\{?([^\}^]+)\}?\^\{?([^\}\s]+)\}?/g, (match, low, high) => {
    try { return renderKaTeX(`\\int_{${low}}^{${high}}`, false); } catch { return match; }
  });

  // ──────────────────────────────────────────────────────────────────────────

  // 2. Process LaTeX geometry/fractions/roots when written directly without $
  // e.g. \frac{20}{25}, 4\frac{1}{5}, \frac{40x^2y+1}{4xy}, \overline{CD}, \vec{QP}, \overleftrightarrow{ZM}, \sqrt{16}, \sqrt[3]{27}, \angle PQR, \Delta ABC
  text = text.replace(/(\b\d+\s*)?\\frac\{([^\}]+)\}\{([^\}]+)\}/g, (match, whole, num, den) => {
    try {
      const latex = whole ? `${whole.trim()}\\frac{${num}}{${den}}` : `\\frac{${num}}{${den}}`;
      return renderKaTeX(latex, false);
    } catch {
      return match;
    }
  });

  // Geometry: \overline{...}, \vec{...}, \overleftrightarrow{...}, \overrightarrow{...}
  text = text.replace(/\\(overline|vec|overleftrightarrow|overrightarrow)\{([^\}]+)\}/g, (match, cmd, val) => {
    try {
      return renderKaTeX(`\\${cmd}{${val}}`, false);
    } catch {
      return match;
    }
  });

  // Roots: \sqrt[3]{...}, \sqrt{...}
  text = text.replace(/\\sqrt(\[[^\]]+\])?\{([^\}]+)\}/g, (match, rootN, val) => {
    try {
      const nPart = rootN || '';
      return renderKaTeX(`\\sqrt${nPart}{${val}}`, false);
    } catch {
      return match;
    }
  });

  // Angles & Triangles: \angle PQR, \Delta ABC
  text = text.replace(/\\(angle|Delta|triangle)\s+([A-Za-z0-9]+)/g, (match, cmd, val) => {
    try {
      return renderKaTeX(`\\${cmd} ${val}`, false);
    } catch {
      return match;
    }
  });

  // ── SMART GEOMETRY UNICODE PATTERN DETECTION ──────────────────────────────
  // Based on actual DB character codes found:
  // Option A: U+2192 (→) + space + MN  → Ray \overrightarrow{MN}
  // Option B: U+2194 (↔) + space + MN  → Line \overleftrightarrow{MN}
  // Option C: U+0304 (combining overline ̄) + space + MN → Segment \overline{MN}
  // Option D: MN (plain)

  // U+2194 ↔ MN → \overleftrightarrow{MN} (Line through two points — double arrow on top)
  text = text.replace(/\u2194\s*([A-Z]{1,4})/g, (_, letters) => {
    try { return renderKaTeX(`\\overleftrightarrow{${letters}}`, false); } catch { return `↔${letters}`; }
  });

  // U+21D4 ⇔ MN → also line
  text = text.replace(/\u21D4\s*([A-Z]{1,4})/g, (_, letters) => {
    try { return renderKaTeX(`\\overleftrightarrow{${letters}}`, false); } catch { return `⇔${letters}`; }
  });

  // U+2192 → MN → \overrightarrow{MN} (Ray — one arrow on top)
  text = text.replace(/\u2192\s*([A-Z]{1,4})/g, (_, letters) => {
    try { return renderKaTeX(`\\overrightarrow{${letters}}`, false); } catch { return `→${letters}`; }
  });

  // U+2190 ← MN → \overleftarrow{MN} (Ray left)
  text = text.replace(/\u2190\s*([A-Z]{1,4})/g, (_, letters) => {
    try { return renderKaTeX(`\\overleftarrow{${letters}}`, false); } catch { return `←${letters}`; }
  });

  // U+0304 ̄ MN (COMBINING OVERLINE — as found in DB option C) → \overline{MN} (Segment bar on top)
  text = text.replace(/\u0304\s*([A-Z]{1,4})/g, (_, letters) => {
    try { return renderKaTeX(`\\overline{${letters}}`, false); } catch { return letters; }
  });

  // U+00AF ¯ or U+203E ‾ MN → \overline{MN} (alternate overline chars)
  text = text.replace(/[\u00AF\u203E]\s*([A-Z]{1,4})/g, (_, letters) => {
    try { return renderKaTeX(`\\overline{${letters}}`, false); } catch { return letters; }
  });

  // MNwithU+0305 (combining overline AFTER letters) → \overline{MN}
  text = text.replace(/([A-Z]{1,4})\u0305/g, (_, letters) => {
    try { return renderKaTeX(`\\overline{${letters}}`, false); } catch { return letters; }
  });

  // Pattern: vec MN or vec{MN} → \vec{MN}
  text = text.replace(/\bvec\s*\{?([A-Z]{1,3})\}?/g, (_, letters) => {
    try { return renderKaTeX(`\\vec{${letters}}`, false); } catch { return `vec(${letters})`; }
  });

  // Degrees: 90^\circ, 90^o, 45\degree -> 90°, 45°
  text = text.replace(/(\d+)\^\\circ/g, '$1°');
  text = text.replace(/(\d+)\^o\b/g, '$1°');
  text = text.replace(/(\d+)\^0\b/g, '$1°');
  text = text.replace(/\\degree\b/g, '°');

  // 3. Mixed Fractions: e.g. 3 1/2, 7 11/12, 4 5/6
  //    -> whole + KaTeX stacked fraction (e.g. 3 and \frac{1}{2})
  text = text.replace(/(\b\d+)\s+([0-9]{1,3})\/([0-9]{1,3})\b/g, (match, whole, num, den) => {
    try {
      return whole + renderKaTeX(`\\frac{${num}}{${den}}`, false);
    } catch {
      return match;
    }
  });

  // 4. ALL standalone numeric fractions -> KaTeX stacked \frac{a}{b} with horizontal bar
  //    e.g. 1/2, 3/4, 20/25, 22/7, 5/12, 11/13, 99/100
  //    Excludes: dates like 15/08/1947 (3-digit denominator with 4-digit year), URLs, decimals
  text = text.replace(
    /(?<![0-9\/\.])([0-9]{1,3})\/([0-9]{1,3})(?![0-9\/\.])/g,
    (match, num, den) => {
      // Skip year-like patterns (denominator >= 1000 context handled by lookbehind/lookahead)
      // Extra safety: if both num & den are large (like 08/2026 context), skip
      if (parseInt(num) > 999 || parseInt(den) > 999) return match;
      try {
        return renderKaTeX(`\\frac{${num}}{${den}}`, false);
      } catch {
        return match;
      }
    }
  );

  // 6. Common Math & Logic Symbols
  const symbols = [
    [ /\\pm\b|\+\-/g, '±' ],
    [ /\\mp\b|\-\+/g, '∓' ],
    [ /\\neq\b|!=|<>/g, '≠' ],
    [ /\\leq\b|\\le\b|<=/g, '≤' ],
    [ /\\geq\b|\\ge\b|>=/g, '≥' ],
    [ /\\approx\b|~=|=~/g, '≈' ],
    [ /\\equiv\b|===/g, '≡' ],
    [ /\\propto\b/g, '∝' ],
    [ /\\times\b/g, '×' ],
    [ /\\div\b/g, '÷' ],
    [ /\\cdot\b/g, '·' ],
    [ /\\infty\b/g, '∞' ],
    [ /\\therefore\b/g, '∴' ],
    [ /\\because\b/g, '∵' ],
    [ /\\implies\b|=>/g, '⇒' ],
    [ /\\iff\b|<=>/g, '⇔' ],
    [ /\\in\b/g, '∈' ],
    [ /\\notin\b/g, '∉' ],
    [ /\\subset\b/g, '⊂' ],
    [ /\\subseteq\b/g, '⊆' ],
    [ /\\supset\b/g, '⊃' ],
    [ /\\supseteq\b/g, '⊇' ],
    [ /\\cup\b|\\union\b/g, '∪' ],
    [ /\\cap\b|\\intersection\b/g, '∩' ],
    [ /\\emptyset\b/g, '∅' ],
    [ /\\perp\b/g, '⊥' ],
    [ /\\parallel\b/g, '∥' ],
    [ /\\cong\b/g, '≅' ],
    [ /\\sim\b/g, '∼' ],
    [ /\\pi\b|\bpi\b/g, 'π' ],
    [ /\\theta\b|\btheta\b/g, 'θ' ],
    [ /\\alpha\b|\balpha\b/g, 'α' ],
    [ /\\beta\b|\bbeta\b/g, 'β' ],
    [ /\\gamma\b|\bgamma\b/g, 'γ' ],
    [ /\\delta\b/g, 'δ' ],
    [ /\\sigma\b/g, 'σ' ],
    [ /\\Sigma\b/g, 'Σ' ],
    [ /\\lambda\b/g, 'λ' ],
    [ /\\mu\b/g, 'μ' ],
    [ /\\phi\b|\bphi\b/g, 'φ' ],
    [ /\\psi\b|\bpsi\b/g, 'ψ' ],
    [ /\\omega\b|\bomega\b/g, 'ω' ],
    [ /\\Omega\b/g, 'Ω' ],
    [ /\\sqrt\b|\bsqrt\b/g, '√' ],
    [ /\\cbrt\b|\bcbrt\b/g, '∛' ]
  ];

  for (const [pattern, sym] of symbols) {
    text = text.replace(pattern, sym);
  }

  // 7. Bracketed Powers: ^{...} or ^(...) -> e.g. x^{n+1} -> xⁿ⁺¹
  text = text.replace(/\^[\{\(]([^\}\)]+)[\}\)]/g, (_, p1) => {
    return p1.split('').map(c => SUPERSCRIPTS[c] || c).join('');
  });

  // 8. Multi-digit powers: ^-1, ^+2, ^10, ^2, ^3
  text = text.replace(/\^([\+\-]?[0-9]+)/g, (_, p1) => {
    return p1.split('').map(c => SUPERSCRIPTS[c] || c).join('');
  });

  // 9. Single variable letter powers: a^n, x^y
  text = text.replace(/\^([a-zA-Z])/g, (_, p1) => {
    return SUPERSCRIPTS[p1] || p1;
  });

  // 10. Bracketed Subscripts: _{...} or _(...) -> e.g. a_{n+1} -> aₙ₊₁
  text = text.replace(/_[\{\(]([^\}\)]+)[\}\)]/g, (_, p1) => {
    return p1.split('').map(c => SUBSCRIPTS[c] || c).join('');
  });

  // 11. Multi-digit or variable subscripts: _1, _2, _n
  text = text.replace(/_([0-9a-zA-Z\+\-])/g, (_, p1) => {
    return SUBSCRIPTS[p1] || p1;
  });

  return text;
}

export default formatMathText;
