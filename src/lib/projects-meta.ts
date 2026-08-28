/**
 * The single slug allowlist. Short human labels for the invite form's <select> — the real
 * titles in page.tsx run to ~90 characters and are unusable in a dropdown.
 */

export const PROJECT_SLUGS = [
  'deutsche-bahn',
  'tokero',
  'dentsply-sirona',
  'happy-media',
  'other',
] as const

export type ProjectSlug = (typeof PROJECT_SLUGS)[number]

export const PROJECT_LABELS: Record<ProjectSlug, string> = {
  'deutsche-bahn': 'Deutsche Bahn — SAP ERP railway QA',
  tokero: 'TOKERO — crypto exchange QA platform',
  'dentsply-sirona': 'Dentsply Sirona — medical CAD/CAM QA',
  'happy-media': 'Happy Media — web platform and campaigns',
  other: 'Something else we worked on',
}

export function isProjectSlug(v: unknown): v is ProjectSlug {
  return typeof v === 'string' && (PROJECT_SLUGS as readonly string[]).includes(v)
}
