// The only executable test harness in this repo. Zero npm dependencies.
// Run: npm run check:tokens
//
// It imports the .ts modules directly — Node >= 22.18 strips types on the fly, so there is
// no build step and no duplicated JS copy of the code under test.

import { isDeepStrictEqual } from 'node:util'

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(
    `check:tokens imports TypeScript directly and needs Node >= 22.18 (type stripping). Found ${process.versions.node}.`,
  )
  process.exit(1)
}

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    fn()
    passed++
    console.log(`PASS  ${name}`)
  } catch (err) {
    failed++
    console.log(`FAIL  ${name}`)
    console.log(`      ${err instanceof Error ? err.message : String(err)}`)
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

function assertDeepEqual(actual, expected, message) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${message}\n      actual:   ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`)
  }
}

// Dynamic, not static: a static import is hoisted above the Node-version guard above,
// so an old Node would die with a parse error instead of the friendly message.
const { FS, b64urlEncode, b64urlDecode, encodeInviteFields, decodeInviteFields, splitToken } =
  await import('../src/lib/token-types.ts')

// --- base64url ---------------------------------------------------------------

check('b64url round trip preserves arbitrary bytes', () => {
  const bytes = new Uint8Array(256)
  for (let i = 0; i < 256; i++) bytes[i] = i
  const back = b64urlDecode(b64urlEncode(bytes))
  assertDeepEqual(Array.from(back), Array.from(bytes), 'bytes changed across the round trip')
})

check('b64url output is URL safe and unpadded', () => {
  const bytes = new Uint8Array([251, 255, 254, 0, 1])
  const encoded = b64urlEncode(bytes)
  assert(/^[A-Za-z0-9_-]+$/.test(encoded), `not URL safe: ${encoded}`)
})

check('b64url round trips every payload length modulo 4', () => {
  for (let n = 1; n <= 8; n++) {
    const bytes = new Uint8Array(n).fill(200)
    const back = b64urlDecode(b64urlEncode(bytes))
    assertDeepEqual(Array.from(back), Array.from(bytes), `length ${n} did not survive`)
  }
})

// --- invite field codec ------------------------------------------------------

const invite = {
  v: '1',
  name: 'Maria Popescu',
  role: 'QA Lead',
  company: 'TOKERO',
  projectSlug: 'tokero',
  message: 'You saw the whole thing from the inside - would you write a few lines?',
  exp: 1801526400,
}

check('invite fields survive encode then decode', () => {
  const decoded = decodeInviteFields(encodeInviteFields(invite))
  assertDeepEqual(decoded, invite, 'invite fields changed across the round trip')
})

check('invite fields survive diacritics and an empty message', () => {
  const withDiacritics = { ...invite, name: 'Andrei Șerban', company: 'Deutsche Bahn', message: '' }
  const decoded = decodeInviteFields(encodeInviteFields(withDiacritics))
  assertDeepEqual(decoded, withDiacritics, 'diacritics or the empty field were mangled')
})

check('encoded payload uses U+001F as the delimiter', () => {
  assert(FS === '\u001F', `FS is ${JSON.stringify(FS)}, expected U+001F`)
  assert(encodeInviteFields(invite).split(FS).length === 7, 'payload is not 7 FS-joined fields')
})

check('wrong arity decodes to null', () => {
  assert(decodeInviteFields(['1', 'a', 'b'].join(FS)) === null, 'three fields should be rejected')
  assert(decodeInviteFields('') === null, 'empty payload should be rejected')
})

check('bad exp decodes to null', () => {
  const bad = ['1', 'A', 'B', 'C', 'tokero', 'msg', 'soon'].join(FS)
  assert(decodeInviteFields(bad) === null, 'non-numeric exp should be rejected')
  const zero = ['1', 'A', 'B', 'C', 'tokero', 'msg', '0'].join(FS)
  assert(decodeInviteFields(zero) === null, 'zero exp should be rejected')
})

check('unknown schema version decodes to null', () => {
  const v2 = ['2', 'A', 'B', 'C', 'tokero', 'msg', '1801526400'].join(FS)
  assert(decodeInviteFields(v2) === null, 'version 2 should be rejected by a v1 decoder')
})

check('a field containing the delimiter throws at mint time', () => {
  let threw = false
  try {
    encodeInviteFields({ ...invite, name: `Maria${FS}Popescu` })
  } catch {
    threw = true
  }
  assert(threw, 'encodeInviteFields accepted a field containing U+001F')
})

// --- token shape -------------------------------------------------------------

check('splitToken accepts payload.sig and rejects everything else', () => {
  assertDeepEqual(splitToken('abc.def'), { payloadB64: 'abc', sigB64: 'def' }, 'valid token misparsed')
  assert(splitToken('abcdef') === null, 'a token with no dot should be rejected')
  assert(splitToken('a.b.c') === null, 'a token with two dots should be rejected')
  assert(splitToken('.def') === null, 'an empty payload should be rejected')
  assert(splitToken('abc.') === null, 'an empty signature should be rejected')
  assert(splitToken('ab+c.def') === null, 'non-base64url characters should be rejected')
})

// --- sanitize ----------------------------------------------------------------

const {
  FieldError,
  CAPS,
  normalizeText,
  graphemeCount,
  sanitizeAnswer,
  sanitizeIdentity,
  extractLinkedinSlug,
} = await import('../src/lib/sanitize.ts')

function assertFieldError(field, fn, message) {
  let caught = null
  try {
    fn()
  } catch (err) {
    caught = err
  }
  assert(caught instanceof FieldError, `${message} — expected a FieldError, got ${caught}`)
  assert(caught.field === field, `${message} — FieldError.field was ${caught.field}, expected ${field}`)
}

// q + combining dot below + combining dot above. No precomposed form, so NFC keeps all three
// code units — .length is 3 per cluster, graphemeCount is 1. That difference is the whole point.
// A ZWJ emoji sequence would NOT work here: U+200D is stripped as a zero-width, by design.
const CLUSTER = 'q' + '\u0323' + '\u0307'

check('graphemeCount counts clusters, not code units', () => {
  const hundred = CLUSTER.repeat(100)
  assert(hundred.length === 300, `expected .length 300, got ${hundred.length}`)
  assert(graphemeCount(hundred) === 100, `expected 100 graphemes, got ${graphemeCount(hundred)}`)
})

check('caps are enforced in graphemes, not code units', () => {
  const hundred = CLUSTER.repeat(100)
  assert(
    sanitizeAnswer('whatIDid', hundred, 100) === hundred,
    '100 clusters should fit a cap of 100 even though .length is 300',
  )
  assertFieldError('whatIDid', () => sanitizeAnswer('whatIDid', hundred, 99), '101st grapheme')
})

check('bidi controls are stripped', () => {
  const attack = 'Maria' + '\u202E' + 'Popescu' + '\u202C'
  assert(normalizeText(attack) === 'MariaPopescu', `bidi survived: ${JSON.stringify(normalizeText(attack))}`)
  assert(sanitizeIdentity('name', attack, CAPS.name) === 'MariaPopescu', 'bidi survived sanitizeIdentity')
})

check('zero-width characters are stripped', () => {
  const sneaky = 'TO' + '\u200B' + 'KE' + '\u200D' + 'RO' + '\uFEFF'
  assert(normalizeText(sneaky) === 'TOKERO', `zero-widths survived: ${JSON.stringify(normalizeText(sneaky))}`)
})

check('C0 controls go, single newlines stay, runs collapse', () => {
  assert(normalizeText('a' + '\u0000' + 'b' + '\u0007' + 'c') === 'abc', 'C0 controls survived')
  assert(normalizeText('one' + '\n' + 'two') === 'one' + '\n' + 'two', 'a single newline was eaten')
  assert(normalizeText('one' + '\n'.repeat(5) + 'two') === 'one' + '\n' + '\n' + 'two', 'newline run not collapsed to two')
  assert(normalizeText('one' + '\r' + '\n' + 'two') === 'one' + '\n' + 'two', 'CRLF not normalised')
})

check('combining-mark runs are capped at four', () => {
  // 'q' has no precomposed form with a dot below, so NFC cannot swallow the first mark.
  const zalgo = 'q' + '\u0323'.repeat(30)
  const out = normalizeText(zalgo)
  assert(out === 'q' + '\u0323'.repeat(4), `expected 4 marks, got ${out.length - 1}`)
})

check('an empty required answer is rejected, an empty optional one is not', () => {
  assertFieldError('hiringManager', () => sanitizeAnswer('hiringManager', '   ', CAPS.hiringManager, true), 'blank required')
  assertFieldError('hiringManager', () => sanitizeAnswer('hiringManager', undefined, CAPS.hiringManager, true), 'missing required')
  assert(sanitizeAnswer('anythingElse', '', CAPS.anythingElse) === '', 'blank optional should return an empty string')
  assert(sanitizeAnswer('anythingElse', undefined, CAPS.anythingElse) === '', 'missing optional should return an empty string')
})

check('identity fields accept real names and reject markup', () => {
  assert(sanitizeIdentity('name', '  Andrei  Serban ', CAPS.name) === 'Andrei Serban', 'inner whitespace not collapsed')
  assert(sanitizeIdentity('company', 'S.C. Happy Media & Co (RO)', CAPS.company) === 'S.C. Happy Media & Co (RO)', 'legal name rejected')
  assert(sanitizeIdentity('role', 'QA Lead / Test Architect', CAPS.role) === 'QA Lead / Test Architect', 'slash rejected')
  assertFieldError('name', () => sanitizeIdentity('name', 'Maria <script>', CAPS.name), 'angle brackets')
  assertFieldError('name', () => sanitizeIdentity('name', 'maria@example.com', CAPS.name), 'at sign')
  assertFieldError('name', () => sanitizeIdentity('name', '   ', CAPS.name), 'blank identity')
})

check('extractLinkedinSlug handles a full https URL', () => {
  assert(
    extractLinkedinSlug('https://www.linkedin.com/in/maria-popescu-8a41b2') === 'maria-popescu-8a41b2',
    'https www URL not reduced to a slug',
  )
})

check('extractLinkedinSlug handles a bare host with a trailing slash', () => {
  assert(
    extractLinkedinSlug('linkedin.com/in/maria-popescu-8a41b2/') === 'maria-popescu-8a41b2',
    'schemeless URL with a trailing slash not reduced to a slug',
  )
})

check('extractLinkedinSlug handles a country subdomain with tracking params', () => {
  assert(
    extractLinkedinSlug('https://ro.linkedin.com/in/%C8%99erban-andrei-5a14a51a5?trk=x') ===
      '%C8%99erban-andrei-5a14a51a5',
    'percent-encoded slug behind a subdomain and a query string was mangled',
  )
})

check('extractLinkedinSlug passes a bare slug through', () => {
  assert(extractLinkedinSlug('maria-popescu-8a41b2') === 'maria-popescu-8a41b2', 'bare slug rejected')
  assert(extractLinkedinSlug('  maria-popescu-8a41b2  ') === 'maria-popescu-8a41b2', 'padded bare slug rejected')
})

check('extractLinkedinSlug refuses anything that is not a LinkedIn profile', () => {
  assertFieldError('linkedinSlug', () => extractLinkedinSlug('https://evil.example.com/in/maria'), 'foreign host')
  assertFieldError('linkedinSlug', () => extractLinkedinSlug('javascript:alert(1)'), 'javascript URL')
  assertFieldError('linkedinSlug', () => extractLinkedinSlug('ab'), 'too short')
  assertFieldError('linkedinSlug', () => extractLinkedinSlug('x'.repeat(61)), 'too long')
  assertFieldError('linkedinSlug', () => extractLinkedinSlug(42), 'not a string')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
