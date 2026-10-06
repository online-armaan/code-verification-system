const crypto = require('crypto');

// Unambiguous alphabet: no O/0, I/1, L, U/V.
const ALPHABET = 'ABCDEFGHJKMNPQRSTWXYZ23456789';

const normalizeCode = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

// Letters, digits and single hyphens between groups; 4-64 chars.
const CODE_REGEX = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const isValidCodeFormat = (code) => code.length >= 4 && code.length <= 64 && CODE_REGEX.test(code);

// Pattern: "X" = random character, "-" = literal hyphen. e.g. XXXX-XXXX-XXXX
const isValidPattern = (pattern) =>
  typeof pattern === 'string' &&
  pattern.length >= 4 &&
  pattern.length <= 64 &&
  /^[Xx-]+$/.test(pattern) &&
  /X/i.test(pattern) &&
  !/^-|-$|--/.test(pattern);

// Unbiased pick using crypto bytes + rejection sampling.
function secureChar() {
  const limit = 256 - (256 % ALPHABET.length);
  for (;;) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < limit) return ALPHABET[byte % ALPHABET.length];
  }
}

function generateCode(pattern = 'XXXX-XXXX-XXXX') {
  return pattern
    .toUpperCase()
    .split('')
    .map((ch) => (ch === 'X' ? secureChar() : ch))
    .join('');
}

const keyspace = (pattern) => Math.pow(ALPHABET.length, (pattern.match(/X/gi) || []).length);

module.exports = { normalizeCode, isValidCodeFormat, isValidPattern, generateCode, keyspace, ALPHABET };
