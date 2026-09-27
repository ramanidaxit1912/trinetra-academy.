/**
 * Trinetra Online Academy - Anti-Cheating Question & Option Shuffling Engine
 * 
 * 1. Shuffles Question order per student attempt.
 * 2. Shuffles Option order (A, B, C, D) per question for each student.
 * 3. Preserves original answer keys (origKey) so backend grading & scoring is 100% accurate.
 * 4. Persists the exact shuffled session in localStorage so page reloads/network reconnects
 *    never scramble questions mid-exam.
 * 5. Intelligently protects Option E (Pinned at bottom) and semantic options like
 *    "All of the above" / "ઉપરોક્ત તમામ" / "A અને B બંને".
 */

/**
 * Fisher-Yates (Knuth) Shuffle algorithm.
 * Returns a new shuffled array without mutating the original.
 */
export function shuffleArray(array) {
  if (!Array.isArray(array) || array.length <= 1) return [...(array || [])];
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Checks if option text contains semantic references to option letters or positions
 * such as "A અને B બંને", "માત્ર A અને C", "(A) or (B)", etc.
 */
export function containsOptionLetterReferences(text) {
  if (!text || typeof text !== 'string') return false;
  const s = text.trim();
  if (/(\b(માત્ર\s+|બંને\s+|both\s+)?\(?[A-E]\)?\s*(અને|&|or|and|\/)\s*\(?[A-E]\)?\b)/i.test(s)) {
    return true;
  }
  return false;
}

/**
 * Checks if option text is "All of the above" / "None of the above" / "ઉપરોક્ત તમામ"
 */
export function isAboveBelowOrAllReference(text) {
  if (!text || typeof text !== 'string') return false;
  const s = text.trim().toLowerCase();
  const patterns = [
    'ઉપરોક્ત તમામ',
    'ઉપરના તમામ',
    'ઉપરના બધા',
    'ઉપર દર્શાવેલ તમામ',
    'ઉપરોક્ત બધા જ',
    'તમામ સાચા',
    'બધા સાચા',
    'all of the above',
    'all of these',
    'ઉપરોક્ત પૈકી એક પણ નહિ',
    'ઉપરોક્ત પૈકી કોઈ નહિ',
    'ઉપરનામાંથી કોઈ નહિ',
    'આપેલ પૈકી કોઈ નહિ',
    'કોઈ પણ નહિ',
    'none of the above',
    'none of these'
  ];
  return patterns.some(p => s.includes(p));
}

/**
 * Get or initialize persistent shuffled questions array for student session.
 * Preserves question order across page reloads and disconnects.
 */
export function getPersistentShuffledQuestions(rawQuestions, studentIdOrMobile, testCode, isShuffleEnabled = true) {
  if (!Array.isArray(rawQuestions) || rawQuestions.length <= 1) {
    return rawQuestions || [];
  }

  // If test explicitly disabled shuffling
  const testDisabled = rawQuestions[0]?.shuffleQuestions === false || rawQuestions[0]?.noShuffle === true;
  if (!isShuffleEnabled || testDisabled) {
    return rawQuestions;
  }

  const storageKey = `trinetra_q_order_${studentIdOrMobile || 'guest'}_${testCode || 'GENERAL'}`;

  try {
    const savedOrderJson = localStorage.getItem(storageKey);
    if (savedOrderJson) {
      const savedIds = JSON.parse(savedOrderJson);
      if (Array.isArray(savedIds) && savedIds.length > 0) {
        const idMap = new Map(rawQuestions.map(q => [q.id, q]));
        const ordered = [];
        savedIds.forEach(id => {
          if (idMap.has(id)) {
            ordered.push(idMap.get(id));
            idMap.delete(id);
          }
        });
        // If there are any questions added or not in saved list, append them
        idMap.forEach(q => ordered.push(q));
        if (ordered.length === rawQuestions.length) {
          return ordered;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load saved question order:', e);
  }

  // Generate new shuffled order
  const shuffled = shuffleArray(rawQuestions);
  try {
    const idList = shuffled.map(q => q.id);
    localStorage.setItem(storageKey, JSON.stringify(idList));
  } catch (e) {
    console.warn('Failed to persist question order:', e);
  }

  return shuffled;
}

/**
 * Get persistent shuffled options list for an MCQ question.
 * Returns array of { displayKey, origKey, rawOpt, rawImg, isOptionE }
 */
export function getPersistentShuffledOptions(currentQ, studentIdOrMobile, activeTestCode, activeTestName, activeSubject, isShuffleEnabled = true) {
  if (!currentQ || currentQ.type !== 'mcq') return [];

  const testMetaStr = `${activeTestName || ''} ${activeSubject || ''} ${activeTestCode || ''} ${currentQ?.subject || ''} ${currentQ?.testName || ''} ${currentQ?.testCode || ''}`.toUpperCase();
  const isTatExam = testMetaStr.includes('TAT-S') || testMetaStr.includes('TAT-HS') || testMetaStr.includes('TAT S') || testMetaStr.includes('TAT HS') || testMetaStr.includes('TATS') || testMetaStr.includes('TATHS');

  // Identify all existing options in original question
  const standardKeys = ['A', 'B', 'C', 'D'];
  const hasOptE = Boolean(
    currentQ.optionE || currentQ.optE ||
    (currentQ.options && (currentQ.options.E || currentQ.options.e || currentQ.options[4])) ||
    isTatExam
  );

  // Collect raw options
  const optionMap = {};
  standardKeys.forEach((key, idx) => {
    let rawText = currentQ[`option${key}`] || currentQ[`opt${key}`] || currentQ[key.toLowerCase()] || (currentQ.options && (currentQ.options[key] || currentQ.options[key.toLowerCase()] || currentQ.options[idx]));
    const rawImg = currentQ[`option${key}_img`] || currentQ[`opt${key}_img`];
    if (rawText || rawImg) {
      optionMap[key] = { text: rawText, img: rawImg };
    }
  });

  if (hasOptE) {
    let rawE = currentQ.optionE || currentQ.optE || currentQ.e || (currentQ.options && (currentQ.options.E || currentQ.options.e || currentQ.options[4]));
    const rawEImg = currentQ.optionE_img || currentQ.optE_img;
    if (!rawE && !rawEImg && isTatExam) {
      rawE = 'ઉત્તર આપવા માંગતા નથી (Not Attempted / Skip)';
    }
    optionMap['E'] = { text: rawE, img: rawEImg };
  }

  const existingKeys = standardKeys.filter(k => Boolean(optionMap[k]));
  if (hasOptE && optionMap['E']) {
    existingKeys.push('E');
  }

  // Check if shuffle should be bypassed for this question
  const testDisabled = currentQ.shuffleQuestions === false || currentQ.noShuffle === true;
  const anyRefToLetters = existingKeys.some(k => containsOptionLetterReferences(optionMap[k]?.text));

  if (!isShuffleEnabled || testDisabled || anyRefToLetters || existingKeys.length <= 1) {
    // Return original order without shuffling
    return existingKeys.map((origKey, idx) => {
      const displayKey = ['A', 'B', 'C', 'D', 'E'][idx] || origKey;
      return {
        displayKey,
        origKey,
        rawOpt: optionMap[origKey]?.text,
        rawImg: optionMap[origKey]?.img,
        isOptionE: origKey === 'E'
      };
    });
  }

  // Check if Option D is "All of the above" / "None of the above"
  // If so, pin D at position D and only shuffle A, B, C!
  const isDPinned = optionMap['D'] && isAboveBelowOrAllReference(optionMap['D']?.text);

  let shuffleableKeys = existingKeys.filter(k => k !== 'E' && !(isDPinned && k === 'D'));
  let pinnedKeys = [];
  if (isDPinned && optionMap['D']) pinnedKeys.push('D');
  if (hasOptE && optionMap['E']) pinnedKeys.push('E');

  // LocalStorage persistence for option order of this question
  const optStorageKey = `trinetra_opt_order_${studentIdOrMobile || 'guest'}_${activeTestCode || 'GENERAL'}`;
  let savedOptOrders = {};
  try {
    const s = localStorage.getItem(optStorageKey);
    if (s) savedOptOrders = JSON.parse(s);
  } catch (e) {}

  let finalKeyOrder = null;
  const qKey = String(currentQ.id || currentQ.text || 'q');

  if (savedOptOrders[qKey] && Array.isArray(savedOptOrders[qKey])) {
    const candidate = savedOptOrders[qKey];
    // Verify candidate has the same keys
    if (candidate.length === existingKeys.length && candidate.every(k => existingKeys.includes(k))) {
      finalKeyOrder = candidate;
    }
  }

  if (!finalKeyOrder) {
    const shuffledShuffleables = shuffleArray(shuffleableKeys);
    finalKeyOrder = [...shuffledShuffleables, ...pinnedKeys];
    savedOptOrders[qKey] = finalKeyOrder;
    try {
      localStorage.setItem(optStorageKey, JSON.stringify(savedOptOrders));
    } catch (e) {}
  }

  return finalKeyOrder.map((origKey, idx) => {
    const displayKey = ['A', 'B', 'C', 'D', 'E'][idx] || origKey;
    return {
      displayKey,
      origKey,
      rawOpt: optionMap[origKey]?.text,
      rawImg: optionMap[origKey]?.img,
      isOptionE: origKey === 'E'
    };
  });
}

/**
 * Clears shuffle storage when a test is submitted or reset
 */
export function clearShuffledTestCache(studentIdOrMobile, testCode) {
  try {
    localStorage.removeItem(`trinetra_q_order_${studentIdOrMobile || 'guest'}_${testCode || 'GENERAL'}`);
    localStorage.removeItem(`trinetra_opt_order_${studentIdOrMobile || 'guest'}_${testCode || 'GENERAL'}`);
  } catch (e) {}
}
