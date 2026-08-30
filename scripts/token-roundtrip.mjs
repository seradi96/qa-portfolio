// The only executable test harness in this repo. Zero npm dependencies.
// Run: npm run check:tokens
//
// It imports the .ts modules directly — Node >= 22.18 strips types on the fly, so there is
// no build step and no duplicated JS copy of the code under test.

import { isDeepStrictEqual } from 'node:util'
import { randomBytes } from 'node:crypto'

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

// --- token crypto ------------------------------------------------------------
// src/lib/token.ts asserts both secrets at module load, so they must exist before the dynamic
// import below. These are test values; they never leave this file and are not the real secrets.
const INVITE_SECRET = 'check-tokens-invite-secret-0123456789'
const MOD_SECRET = 'check-tokens-moderation-secret-0123456789'
process.env.INVITE_SECRET = INVITE_SECRET
process.env.MOD_SECRET = MOD_SECRET

// `invite` is already declared above (invite field codec section) and is reused here rather than
// redeclared, which would be a SyntaxError at module scope.
const { SITE_ORIGIN, INVITE_TTL_DAYS, assertSecret, signInviteToken, verifyInviteToken } =
  await import('../src/lib/token.ts')

// 1 — round trip
check('an invite token survives a full round trip', () => {
  assertDeepEqual(
    verifyInviteToken(signInviteToken(invite, INVITE_SECRET), INVITE_SECRET),
    invite,
    'invite round trip lost data',
  )
  assert(SITE_ORIGIN === 'https://aserban.ro', 'SITE_ORIGIN is not the hardcoded production origin')
  assert(INVITE_TTL_DAYS === 45, `INVITE_TTL_DAYS is ${INVITE_TTL_DAYS}, expected 45`)
})

// 2 — tamper must fail
// One row in the table, not two: the m1 moderation family is gone. The table shape stays so a
// second family can be added back as a row rather than as a rewrite.
check('a single flipped payload byte fails verification', () => {
  for (const [label, token, secret, verify] of [
    ['invite', signInviteToken(invite, INVITE_SECRET), INVITE_SECRET, verifyInviteToken],
  ]) {
    const [payload, sig] = token.split('.')
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    const at = Math.floor(payload.length / 2)
    const swapped = alphabet[(alphabet.indexOf(payload[at]) + 1) % alphabet.length]
    const tampered = `${payload.slice(0, at)}${swapped}${payload.slice(at + 1)}.${sig}`
    assert(tampered !== token, `${label}: the tamper did not change the token`)
    assert(verify(tampered, secret) === null, `${label}: a tampered payload verified`)
  }
})

// The i1-versus-m1 domain-separation assertion lived here. It went out with m1 — with a single
// family left there is no second domain in this module to confuse. The property itself is still
// covered, in the admin session section at the bottom of this file: "a stamp signed under the
// invite i1 domain does not verify as a session".

// 3 — empty secret must throw
check('an empty, short or missing secret throws', () => {
  for (const bad of [undefined, '', 'short', 'x'.repeat(31)]) {
    let threw = false
    try {
      assertSecret('INVITE_SECRET', bad)
    } catch {
      threw = true
    }
    assert(threw, `assertSecret accepted ${JSON.stringify(bad)}`)
  }
  assert(
    assertSecret('INVITE_SECRET', 'y'.repeat(32)) === 'y'.repeat(32),
    'a 32-character secret was rejected',
  )
  let signThrew = false
  try {
    signInviteToken(invite, '')
  } catch {
    signThrew = true
  }
  assert(signThrew, 'signInviteToken signed with an empty secret')
})

// 4 — wrong-length signature must be null, not RangeError
check('a wrong-length signature returns null instead of throwing RangeError', () => {
  const [payload] = signInviteToken(invite, INVITE_SECRET).split('.')
  for (const sig of ['A', 'AA', 'A'.repeat(43), 'A'.repeat(86)]) {
    let result
    try {
      result = verifyInviteToken(`${payload}.${sig}`, INVITE_SECRET)
    } catch (err) {
      throw new Error(`verifyInviteToken threw on a ${sig.length}-char signature: ${err}`)
    }
    assert(result === null, `a ${sig.length}-char signature verified`)
  }
})

// --- client-side decoding (no secret) ----------------------------------------
// The invite fragment is plain base64url over an FS-joined string — no compression — so the
// browser path is genuinely executable here rather than only reasoned about.

async function checkAsync(name, fn) {
  try {
    await fn()
    passed++
    console.log(`PASS  ${name}`)
  } catch (err) {
    failed++
    console.log(`FAIL  ${name}`)
    console.log(`      ${err instanceof Error ? err.message : String(err)}`)
  }
}

const { decodeInviteUnverified } = await import('../src/lib/token-client.ts')

const clientInvite = {
  v: '1',
  name: 'Maria Popescu',
  role: 'QA Lead',
  company: 'TOKERO',
  projectSlug: 'tokero',
  message: 'A few lines about the suite?',
  exp: 1801526400,
}

check('the invite fragment decodes to the same fields the server will verify', () => {
  const token = signInviteToken(clientInvite, INVITE_SECRET)
  assertDeepEqual(decodeInviteUnverified(`#${token}`), clientInvite, 'prefill differs from the signed fields')
  assertDeepEqual(decodeInviteUnverified(token), clientInvite, 'a fragment without the leading # was rejected')
})

check('a forged invite signature still decodes here, because this module cannot verify', () => {
  const [payload] = signInviteToken(clientInvite, INVITE_SECRET).split('.')
  const forged = decodeInviteUnverified(`#${payload}.${'A'.repeat(43)}`)
  assert(
    forged !== null && forged.name === clientInvite.name,
    'the trust boundary moved: token-client must decode WITHOUT verifying, or the browser needs a secret',
  )
})

check('malformed invite fragments return null', () => {
  for (const bad of ['', '#', '#notatoken', '#a.b.c', '#.', `#${'A'.repeat(20)}`]) {
    assert(decodeInviteUnverified(bad) === null, `expected null for ${JSON.stringify(bad)}`)
  }
})

// --- admin session cookie ----------------------------------------------------
// randomBytes is imported statically at the top of this file; createHmac is not, and this file
// is append-only, so it is pulled in here rather than by editing that import.
const { createHmac } = await import('node:crypto')

// src/lib/admin-auth.ts asserts ADMIN_PASSWORD at module load (and imports token.ts, whose own
// module-scope asserts already ran above), so it must exist before the dynamic import below.
// A test value; it is not the real password and never leaves this file.
const ADMIN_PASSWORD = 'check-tokens-admin-password-0123456789'
process.env.ADMIN_PASSWORD = ADMIN_PASSWORD

const { SESSION_COOKIE, SESSION_TTL_SECONDS, checkPassword, mintSession, verifySession } =
  await import('../src/lib/admin-auth.ts')

// A fixed clock, so "expired" is a property of the assertion and not of when the suite runs.
const NOW = 1800000000

// 1 - round trip
check('an admin session token survives a full round trip', () => {
  assert(SESSION_COOKIE === 'admin_session', `SESSION_COOKIE is ${SESSION_COOKIE}`)
  assert(SESSION_TTL_SECONDS === 2592000, `SESSION_TTL_SECONDS is ${SESSION_TTL_SECONDS}`)
  const token = mintSession(NOW)
  assert(
    /^[0-9]{10}\.[A-Za-z0-9_-]{43}$/.test(token),
    `token is not <expiry>.<base64url sha256>: ${token}`,
  )
  assert(token.split('.')[0] === String(NOW + SESSION_TTL_SECONDS), 'expiry stamp is wrong')
  assert(verifySession(token, NOW) === true, 'a freshly minted session did not verify')
  // Cookie-safe: no ';', ',', '=' or whitespace, so it needs no quoting in a Set-Cookie header.
  assert(!/[;,=\s"]/.test(token), `token needs cookie quoting: ${token}`)
})

// 2 - tamper must fail
check('a tampered admin session signature fails verification', () => {
  const token = mintSession(NOW)
  const [stamp, sig] = token.split('.')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const at = Math.floor(sig.length / 2)
  const swapped = alphabet[(alphabet.indexOf(sig[at]) + 1) % alphabet.length]
  const tampered = `${stamp}.${sig.slice(0, at)}${swapped}${sig.slice(at + 1)}`
  assert(tampered !== token, 'the tamper did not change the token')
  assert(verifySession(tampered, NOW) === false, 'a tampered signature verified')
  // Moving the expiry stamp forward is the interesting forgery: it is signed, so it must fail.
  assert(
    verifySession(`${Number(stamp) + 86400}.${sig}`, NOW) === false,
    'an extended expiry verified against the original signature',
  )
})

// 3 - expiry must be enforced
check('an expired admin session fails verification', () => {
  const token = mintSession(NOW)
  assert(verifySession(token, NOW + SESSION_TTL_SECONDS - 1) === true, 'rejected one second early')
  assert(verifySession(token, NOW + SESSION_TTL_SECONDS) === false, 'accepted at the exact expiry')
  assert(verifySession(token, NOW + SESSION_TTL_SECONDS + 1) === false, 'accepted after expiry')
})

// 4 - wrong domain must fail
check('a stamp signed under the invite i1 domain does not verify as a session', () => {
  const expiry = NOW + SESSION_TTL_SECONDS
  const asI1 = createHmac('sha256', MOD_SECRET).update(`i1.${expiry}`, 'utf8').digest('base64url')
  assert(verifySession(`${expiry}.${asI1}`, NOW) === false, 'an i1-domain MAC verified as s1')
  const wrongKey = createHmac('sha256', INVITE_SECRET)
    .update(`s1.${expiry}`, 'utf8')
    .digest('base64url')
  assert(verifySession(`${expiry}.${wrongKey}`, NOW) === false, 'INVITE_SECRET signed a session')
})

// 5 - wrong-length signature must be false, not RangeError
check('a wrong-length admin session signature returns false instead of throwing RangeError', () => {
  const [stamp] = mintSession(NOW).split('.')
  for (const sig of ['A', 'AA', 'A'.repeat(42), 'A'.repeat(44), 'A'.repeat(86)]) {
    let result
    try {
      result = verifySession(`${stamp}.${sig}`, NOW)
    } catch (err) {
      throw new Error(`verifySession threw on a ${sig.length}-char signature: ${err}`)
    }
    assert(result === false, `a ${sig.length}-char signature verified`)
  }
  for (const bad of [undefined, '', '.', 'nodot', 'a.b.c', `${NOW}.`, `x.${'A'.repeat(43)}`]) {
    let result
    try {
      result = verifySession(bad, NOW)
    } catch (err) {
      throw new Error(`verifySession threw on ${JSON.stringify(bad)}: ${err}`)
    }
    assert(result === false, `expected false for ${JSON.stringify(bad)}`)
  }
})

// 6 - the password comparison
check('checkPassword accepts only the exact password, and never throws', () => {
  assert(checkPassword(ADMIN_PASSWORD) === true, 'the real password was rejected')
  const sameLength = `${ADMIN_PASSWORD.slice(0, -1)}X`
  assert(sameLength.length === ADMIN_PASSWORD.length, 'the fixture is not the same length')
  assert(checkPassword(sameLength) === false, 'a same-length wrong password was accepted')
  // The RangeError trap: timingSafeEqual throws on unequal lengths, so a short guess must be
  // caught by the length check and come back as a plain false (a 401), never a 500.
  for (const bad of ['', 'short', `${ADMIN_PASSWORD}x`, undefined, null, 42, {}, []]) {
    let result
    try {
      result = checkPassword(bad)
    } catch (err) {
      throw new Error(`checkPassword threw on ${JSON.stringify(bad)}: ${err}`)
    }
    assert(result === false, `checkPassword accepted ${JSON.stringify(bad)}`)
  }
})

// 7 - a short or missing ADMIN_PASSWORD must break the build, not the login
await checkAsync('an empty or short ADMIN_PASSWORD throws at module load', async () => {
  try {
    for (const bad of ['', 'x'.repeat(23), 'correct horse battery']) {
      process.env.ADMIN_PASSWORD = bad
      let threw = false
      try {
        // A query string forces Node to re-evaluate the module instead of serving the cached
        // instance; the extension in the pathname still selects type stripping.
        await import(`../src/lib/admin-auth.ts?bad-password-${encodeURIComponent(bad)}`)
      } catch {
        threw = true
      }
      assert(threw, `admin-auth.ts loaded with ADMIN_PASSWORD = ${JSON.stringify(bad)}`)
    }
  } finally {
    // This file shares one module scope and is appended to over time: leaving the environment
    // broken would fail whatever is added below for a reason that has nothing to do with it.
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD
  }
})

// --- linkedin slugs with diacritics ------------------------------------------
// Chrome copies the percent-encoded address; Safari and Firefox copy the decoded one. Both forms
// have to reach the same slug, because this site's colleagues are Romanian and German and their
// slugs carry diacritics as a matter of course.
const REAL_ENCODED = '%C8%99erban-andrei-5a14a51a5'

check('a pasted URL keeps working when the browser percent-encoded it', () => {
  assert(
    extractLinkedinSlug(`https://www.linkedin.com/in/${REAL_ENCODED}/`) === REAL_ENCODED,
    'the already-encoded form did not survive',
  )
  assert(
    extractLinkedinSlug(`https://www.linkedin.com/in/${REAL_ENCODED}/?trk=nav`) === REAL_ENCODED,
    'tracking parameters were not stripped',
  )
})

check('a pasted URL carrying a literal diacritic is encoded, not refused', () => {
  for (const raw of [
    'https://www.linkedin.com/in/\u0219erban-andrei-5a14a51a5',
    'https://www.linkedin.com/in/\u0219erban-andrei-5a14a51a5/',
    'linkedin.com/in/\u0219erban-andrei-5a14a51a5',
    '\u0219erban-andrei-5a14a51a5',
  ]) {
    assert(extractLinkedinSlug(raw) === REAL_ENCODED, `not encoded: ${raw}`)
  }
  // German and Romanian shapes generally, not just this one name.
  assert(extractLinkedinSlug('m\u00fcller-schmidt-1a2b') === 'm%C3%BCller-schmidt-1a2b', 'umlaut')
  assert(extractLinkedinSlug('ion-\u021birlea-9f8e') === 'ion-%C8%9Birlea-9f8e', 'comma-below t')
})

check('encoding never widens what a slug may contain', () => {
  // The href is built by templating a literal host with this value, so the alphabet IS the
  // security property. Everything that could change the destination must still be refused.
  for (const hostile of [
    'javascript:alert(1)',
    'https://evil.com/in/hacker',
    '../../etc/passwd',
    'name/with/slashes',
    'has space',
    'a',
    'x'.repeat(61),
  ]) {
    let threw = false
    try {
      extractLinkedinSlug(hostile)
    } catch {
      threw = true
    }
    assert(threw, `accepted hostile input: ${JSON.stringify(hostile)}`)
  }
  // And an already-encoded slug is never encoded twice.
  assert(!extractLinkedinSlug(REAL_ENCODED).includes('%25'), 'double-encoded an encoded slug')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)

