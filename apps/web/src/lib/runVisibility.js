export function isCommunityRun(run) {
  return run?.publishState === 'published' || run?.publishSource === 'community-api'
}

export function runVisibility(run) {
  if (isCommunityRun(run)) return 'community'
  if (run?.publishState === 'failed') return 'publish-failed'
  if (run?.publish && (run?.publishState === 'pending' || !run?.publishState)) return 'publishing'
  return 'local'
}

export function groupVisibility(group) {
  return group?.runs?.some(isCommunityRun) ? 'community' : 'local'
}
