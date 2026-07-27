export function isRunPublished(run) {
  return run?.publishState === 'published' || run?.publishSource === 'community-api'
}

export function canReadRun(run, email) {
  return Boolean(run && (isRunPublished(run) || (email && run.user === email)))
}

export function canManageRun(run, email) {
  return Boolean(run && email && run.user === email)
}

export function visibleRunsFor(runs, email) {
  return runs.filter((run) => canReadRun(run, email))
}
