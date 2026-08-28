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

const {
  SITE_ORIGIN,
  INVITE_TTL_DAYS,
  MAX_MODERATION_URL_CHARS,
  assertSecret,
  signInviteToken,
  verifyInviteToken,
  signModerationToken,
  verifyModerationToken,
} = await import('../src/lib/token.ts')

// `invite` is already declared above (invite field codec section) with this exact shape and
// value — reused here rather than redeclared, which would be a SyntaxError at module scope.
const record = {
  id: 'aB3xK9pQr7Zt',
  projectSlug: 'tokero',
  publishedAt: '2026-09-14',
  submittedAt: '2026-09-13',
  consent: { version: 1, at: '2026-09-13T18:42:07Z' },
  author: {
    name: 'Maria Popescu',
    role: 'QA Lead',
    company: 'TOKERO',
    linkedinSlug: 'maria-popescu-8a41b2',
  },
  answers: {
    whatIDid: 'He owned the end-to-end suite.',
    whatChanged: 'Regression went from two days of clicking to an overnight run.',
    hiringManager: 'I would work with him again. He pushes back when the plan is wrong.',
    anythingElse: '',
  },
}

// 1 — round trip
check('invite and moderation tokens survive a full round trip', () => {
  assertDeepEqual(
    verifyInviteToken(signInviteToken(invite, INVITE_SECRET), INVITE_SECRET),
    invite,
    'invite round trip lost data',
  )
  assertDeepEqual(
    verifyModerationToken(signModerationToken(record, MOD_SECRET), MOD_SECRET),
    record,
    'moderation round trip lost data',
  )
  assert(SITE_ORIGIN === 'https://aserban.ro', 'SITE_ORIGIN is not the hardcoded production origin')
  assert(INVITE_TTL_DAYS === 45, `INVITE_TTL_DAYS is ${INVITE_TTL_DAYS}, expected 45`)
})

// 2 — tamper must fail
check('a single flipped payload byte fails verification', () => {
  for (const [label, token, secret, verify] of [
    ['invite', signInviteToken(invite, INVITE_SECRET), INVITE_SECRET, verifyInviteToken],
    ['moderation', signModerationToken(record, MOD_SECRET), MOD_SECRET, verifyModerationToken],
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

// 3 — wrong domain must fail
check('a token signed under i1 never verifies under m1', () => {
  assert(
    verifyModerationToken(signInviteToken(invite, MOD_SECRET), MOD_SECRET) === null,
    'an i1 token verified as m1',
  )
  assert(
    verifyInviteToken(signModerationToken(record, INVITE_SECRET), INVITE_SECRET) === null,
    'an m1 token verified as i1',
  )
})

// 4 — empty secret must throw
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

// 5 — wrong-length signature must be null, not RangeError
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

// 6 — URL budget
// Caps are read from CAPS, never retyped: raising a cap must move these numbers.
// CAPS is already destructured above (sanitize section) from the same module — reused here
// rather than re-imported, which would be a SyntaxError at module scope.

const PROSE = {
  whatIDid:
    'He owned the end-to-end suite from the first spec through to the pipeline that ran it, and he was the person we pinged when a build went red at six in the evening. He wrote the framework, reviewed our page objects, and taught two of us how to debug a flaky test without guessing at it.',
  whatChanged:
    'Regression used to eat two days of manual clicking before every release and we still shipped with our fingers crossed. After his framework landed it ran overnight on every merge, we saw failures at nine in the morning with a trace attached, and the release meeting stopped being an argument about whether anyone had actually tested the payment flow properly on a real device this time.',
  hiringManager:
    'I would work with him again without thinking about it. He will push back if he believes the plan is wrong, which is exactly what you want from someone who owns quality, and he does it with evidence in hand rather than an opinion. He is also the rare automation engineer who writes documentation that other people on the team can actually follow a year later without asking him.',
  anythingElse:
    'The thing I remember is the week the payment provider changed a response field without telling anyone. His suite caught it in the overnight run, he had the failing trace and a one paragraph explanation in our channel before the standup, and the fix shipped that afternoon instead of being discovered by a customer. Nobody outside the team ever knew. He also refused to let us mark that test as flaky and skip it, which in hindsight is the only reason it was still running at all. That is the part people miss about test automation: the value is not the tests you write, it is the ones you keep honest for two years after everybody who first wrote them has moved on to some other team.',
}

// Romanian ABSOLUTE MAXIMUM, not a realistic submission and not a translation of PROSE above —
// four independently written, high-entropy passages (varied vocabulary, real place names —
// Bucuresti, Cluj-Napoca, Timisoara, Iasi, Brasov, Constanta, Viena, Munchen, Frankfurt,
// Stuttgart — few repeated phrases) so gzip cannot find the easy wins repeated sentences give
// it. This is the case that actually overflowed at the old cap: at anythingElse 700 this exact
// shape of fixture measured over MAX_MODERATION_URL_CHARS, which is why CAPS.anythingElse in
// src/lib/sanitize.ts is 550, not 700. Diacritics cost two UTF-8 bytes each pre-gzip, and this
// project's own colleagues are Romanian and German, so this is the worst case worth pinning, not
// the English one. Each passage is written long enough to already meet its cap in code units,
// same discipline as PROSE above, so toCap only ever slices here — it never doubles, because
// doubling a paragraph lets gzip crush it and the measurement stops meaning anything (this
// mistake was made once measuring an earlier version of this exact fixture: 740 chars instead of
// the real figure, because a doubled paragraph compresses far better than natural prose does).
const PROSE_RO_MAX = {
  whatIDid:
    'A coordonat migrarea suitei de regresie din Selenium către Playwright pe durata a trei sprinturi, cu echipe distribuite între București, Cluj-Napoca și Hamburg. A construit un raportor propriu peste Allure, a integrat Grafana pentru urmărirea flakiness-ului și a documentat totul într-un wiki Confluence pe care noii angajați îl parcurg în prima săptămână, nu în a treia lună ca înainte.',
  whatChanged:
    'Înainte de proiect, echipa din Timișoara rula manual peste patru sute de cazuri înaintea fiecărei lansări trimestriale, cu foi Excel partajate prin e-mail și desincronizate în permanență. După implementare, pipeline-ul din GitLab CI declanșează automat suita nocturnă, notifică pe Slack canalul #qa-alerts și atașează un raport HTML cu capturi video pentru fiecare eșec, direct din regiunea Frankfurt unde rulează agenții.',
  hiringManager:
    'L-aș recomanda oricând unui client din Iași sau din Stuttgart fără nicio ezitare, indiferent de mărimea echipei sau de complexitatea integrării. Nu acceptă un plan de testare doar pentru că vine de la un arhitect senior, ci cere date concrete și le aduce el însuși dacă lipsesc. A mentorat trei ingineri juniori din echipa de la Brașov, iar doi dintre ei conduc acum propriile module de automatizare, ceea ce spune mai multe despre el decât orice recomandare scrisă vreodată.',
  anythingElse:
    'Povestea pe care o repet cel mai des colegilor din Constanța este cea cu integrarea de plăți SEPA: un furnizor extern din Viena a modificat formatul unui câmp XML fără preaviz, iar suita construită de el a prins discrepanța chiar în rularea de dimineață, cu un raport care indica exact linia din schema XSD afectată. A scris un script Python separat care validează schema la fiecare build, independent de suita principală din TypeScript, tocmai pentru cazurile în care API-ul extern se schimbă fără avertisment. Anul trecut, când departamentul de conformitate din Munchen a cerut un audit complet al urmelor de testare pentru ultimele douăsprezece luni, a reușit să extragă totul dintr-o interogare SQL scrisă cu o seară înainte, pentru că fiecare rulare salvează metadate structurate într-o bază PostgreSQL separată de artefactele CI. Nimeni altcineva din organizație nu ar fi putut face asta la fel de repede, iar auditul s-a încheiat fără nicio observație, lucru rar pentru o echipă de dimensiunea noastră răspândită pe trei fusuri orare.',
}

const toCap = (text, cap) => (text.length >= cap ? text.slice(0, cap) : `${text} ${text}`.slice(0, cap))
const noise = (n) => randomBytes(n * 2).toString('base64').replace(/[+/=]/g, 'A').slice(0, n)

function moderationUrlFor(answers, author) {
  const token = signModerationToken({ ...record, answers, author }, MOD_SECRET)
  return `${SITE_ORIGIN}/moderate#a=publish&t=${token}`
}

const naturalUrl = moderationUrlFor(
  {
    whatIDid: toCap(PROSE.whatIDid, CAPS.whatIDid),
    whatChanged: toCap(PROSE.whatChanged, CAPS.whatChanged),
    hiringManager: toCap(PROSE.hiringManager, CAPS.hiringManager),
    anythingElse: toCap(PROSE.anythingElse, CAPS.anythingElse),
  },
  {
    name: toCap('Maria Alexandra Popescu-Ionescu', CAPS.name),
    role: toCap('Senior Quality Assurance Engineer, Payments', CAPS.role),
    company: toCap('Deutsche Bahn Vertrieb GmbH', CAPS.company),
    linkedinSlug: 'maria-popescu-8a41b2',
  },
)

// Slug at exactly 60 characters encoded — extractLinkedinSlug's own SLUG regex caps a slug at 60,
// so this is the longest one the real system will ever accept, not an arbitrary round number.
// LinkedIn (and encodeURIComponent, which matches its behavior) leaves ASCII letters, digits and
// hyphens alone and percent-encodes only the non-ASCII UTF-8 bytes — each of the 3 diacritics
// below costs 6 encoded characters (%XX%XX) instead of 1, which is the whole mechanism this
// fixture exists to exercise, same shape as this site owner's own real slug
// (%C8%99erban-andrei-5a14a51a5, see src/lib/sanitize.ts).
const romanianSlugMax = encodeURIComponent('ștefania-brâncoveanu-vodă-1a2b3c4d5e6f7g8h9i0')

// ABSOLUTE MAXIMUM, not a typical submission: every answer at its exact cap, name/role/company
// each sliced to exactly 80 graphemes of Romanian, and a slug encoded to exactly 60 characters —
// simultaneously, because that combination, not any single field alone, is what a real submitter
// who fills in every box the site offers would actually send.
const romanianUrlMax = moderationUrlFor(
  {
    whatIDid: toCap(PROSE_RO_MAX.whatIDid, CAPS.whatIDid),
    whatChanged: toCap(PROSE_RO_MAX.whatChanged, CAPS.whatChanged),
    hiringManager: toCap(PROSE_RO_MAX.hiringManager, CAPS.hiringManager),
    anythingElse: toCap(PROSE_RO_MAX.anythingElse, CAPS.anythingElse),
  },
  {
    name: toCap('Ștefania-Ioana Marinescu-Vasilescu, cunoscută în toată echipa drept Fani din Cluj-Napoca', CAPS.name),
    role: toCap('Coordonator Senior de Automatizare a Testelor pentru Plăți Transfrontaliere SEPA', CAPS.role),
    company: toCap('Grupul Financiar Est-Vest de Consultanță și Tehnologie Digitală Aplicată SRL Cluj', CAPS.company),
    linkedinSlug: romanianSlugMax,
  },
)

const noiseUrl = moderationUrlFor(
  {
    whatIDid: noise(CAPS.whatIDid),
    whatChanged: noise(CAPS.whatChanged),
    hiringManager: noise(CAPS.hiringManager),
    anythingElse: noise(CAPS.anythingElse),
  },
  {
    name: noise(CAPS.name),
    role: noise(CAPS.role),
    company: noise(CAPS.company),
    linkedinSlug: noise(60),
  },
)

console.log(
  `      URL budget ${MAX_MODERATION_URL_CHARS}: ` +
    `English at every cap = ${naturalUrl.length} chars (${MAX_MODERATION_URL_CHARS - naturalUrl.length} spare), ` +
    `Romanian ABSOLUTE MAXIMUM (every cap + 60-char slug) = ${romanianUrlMax.length} chars ` +
    `(${MAX_MODERATION_URL_CHARS - romanianUrlMax.length} spare), ` +
    `incompressible at every cap = ${noiseUrl.length} chars (${noiseUrl.length - MAX_MODERATION_URL_CHARS} over)`,
)

check('natural-language answers at every cap fit the moderation URL', () => {
  assert(
    naturalUrl.length <= MAX_MODERATION_URL_CHARS,
    `natural-language worst case is ${naturalUrl.length} chars, over the ${MAX_MODERATION_URL_CHARS} budget. Lower a cap in CAPS, or raise MAX_MODERATION_URL_CHARS knowing Outlook truncates around 2000.`,
  )
})

// This is not the realistic case any more — it is the LEGAL MAXIMUM the form allows, because the
// legal maximum is what overflowed. At the original CAPS.anythingElse of 700, a fixture shaped
// exactly like this one (every field at its cap, a 60-char encoded slug, high-entropy Romanian
// prose gzip cannot flatten) went over MAX_MODERATION_URL_CHARS — a Romanian colleague thorough
// enough to fill in every field would have gotten a 413 after writing a page and a half. That is
// why anythingElse is 550 in src/lib/sanitize.ts, not 700. A future cap raise that only re-checks
// the English assertion above can still reintroduce that failure — this assertion is what makes
// it visible before a real thorough submitter finds it.
check('Romanian answers at every cap, including a 60-char encoded slug, fit the moderation URL (absolute maximum)', () => {
  assert(
    romanianUrlMax.length <= MAX_MODERATION_URL_CHARS,
    `Romanian absolute-maximum case is ${romanianUrlMax.length} chars, over the ${MAX_MODERATION_URL_CHARS} budget. Lower a cap in CAPS, or raise MAX_MODERATION_URL_CHARS knowing Outlook truncates around 2000.`,
  )
})

check('incompressible answers at every cap overflow the budget, which is what the 413 is for', () => {
  assert(
    noiseUrl.length > MAX_MODERATION_URL_CHARS,
    `incompressible worst case now fits (${noiseUrl.length} chars). Caps must have been lowered — /api/testimonials/submit can drop its 413 branch, and this check should be deleted with it.`,
  )
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
