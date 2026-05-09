import type { HomeOverview } from '@/types/study'
import { getLocalPracticeHomeOverview, getPracticeHomeOverview } from '@/services/nursing'

export async function getHomeOverview(): Promise<HomeOverview> {
  return getPracticeHomeOverview()
}

export function getLocalHomeOverview(): HomeOverview {
  return getLocalPracticeHomeOverview()
}
