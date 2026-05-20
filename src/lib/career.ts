export const QA_CAREER_START = new Date('2021-05-01')
export const PLAYWRIGHT_START = new Date('2023-05-01')
export const KARATE_START = new Date('2023-05-01')

export function getYearsSince(startDate: Date): number {
  const now = new Date()
  let years = now.getFullYear() - startDate.getFullYear()
  const monthDiff = now.getMonth() - startDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < startDate.getDate())) {
    years--
  }
  return years
}
