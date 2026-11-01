/**
 * ClassPulse Profanity & Offensive Language Filter
 * 
 * Provides automated detection of abusive, vulgar, or offensive terms
 * in student live word cloud submissions.
 */

// List of profane / abusive keywords and patterns (lowercased)
const OFFENSIVE_TERMS = [
  'fuck', 'fucking', 'fucker', 'fucked', 'fuckk', 'fck',
  'shit', 'shitty', 'bullshit',
  'bitch', 'bitches', 'bitching',
  'asshole', 'ass', 'asses', 'dumbass', 'badass',
  'bastard', 'bastards',
  'dick', 'dicks', 'dickhead',
  'cunt', 'cunts',
  'cock', 'cocks', 'cocksucker',
  'slut', 'sluts',
  'whore', 'whores',
  'pussy', 'pussies',
  'fag', 'faggot', 'faggots',
  'nigger', 'nigga', 'niggers', 'niggas',
  'retard', 'retarded',
  'porn', 'porno', 'sex', 'sexy', 'horny', 'orgasm',
  'motherfucker', 'motherfucking',
  'bollocks', 'wanker',
  'chutiya', 'madarchod', 'behenchod', 'bhenchod', 'gand', 'gaand', 'bhosadi', 'bhosdike', 'lodu', 'lauda', 'harami', 'kameena'
];

// Leetspeak mapping
const LEET_MAP = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
  '+': 't',
};

/**
 * Normalizes a text string by:
 * 1. Lowercasing
 * 2. Translating leetspeak numbers/symbols to letters
 * 3. Collapsing repeated characters (e.g. "fuuuck" -> "fuck")
 */
function normalizeText(input) {
  if (!input || typeof input !== 'string') return '';
  
  let text = input.toLowerCase();

  // Leet map replacement
  let leetCleaned = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    leetCleaned += LEET_MAP[ch] || ch;
  }

  // Collapse consecutive identical characters to at most 1 (e.g. "shiiit" -> "shit", "fuuuuck" -> "fuck")
  const collapsed = leetCleaned.replace(/(.)\1+/g, '$1');

  // Strip all non-alphanumeric punctuation and spaces
  const alphanumericOnly = collapsed.replace(/[^a-z0-9]/g, '');

  return {
    raw: text,
    collapsed,
    alphanumericOnly,
  };
}

/**
 * Check if the text contains offensive or prohibited words.
 * @param {string} text - The input submission string
 * @returns {{ isBlocked: boolean, reason: string | null, matchedWord: string | null }}
 */
function checkProfanity(text) {
  if (!text || typeof text !== 'string') {
    return { isBlocked: false, reason: null, matchedWord: null };
  }

  const { raw, collapsed, alphanumericOnly } = normalizeText(text);

  // 1. Direct word boundary check on raw and collapsed
  for (const term of OFFENSIVE_TERMS) {
    const regex = new RegExp(`(^|\\b|_)${term}($|\\b|_)`, 'i');
    if (regex.test(raw) || regex.test(collapsed)) {
      return {
        isBlocked: true,
        reason: `Flagged by profanity filter (matches "${term}")`,
        matchedWord: term,
      };
    }

    // 2. Continuous string check (e.g., student typed "f.u.c.k" or "f u c k" which collapsed to "fuck")
    if (term.length >= 4 && alphanumericOnly.includes(term)) {
      return {
        isBlocked: true,
        reason: `Flagged by profanity filter (matches "${term}")`,
        matchedWord: term,
      };
    }
  }

  return { isBlocked: false, reason: null, matchedWord: null };
}

module.exports = {
  checkProfanity,
  normalizeText,
  OFFENSIVE_TERMS,
};
