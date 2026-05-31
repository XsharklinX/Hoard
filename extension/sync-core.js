export async function pushPendingItems({ items, postItem, markSynced, markFailed }) {
  const syncedIds = []
  for (const item of items) {
    try {
      const payload = { ...item }
      if (payload.type === 'image') payload.srcUrl = payload.url
      const response = await postItem(payload)
      if (!response.ok) throw new Error(`Desktop app returned ${response.status}`)
      if (item.id != null) syncedIds.push(item.id)
    } catch (error) {
      if (item.id != null) await markFailed(item.id, error)
    }
  }
  if (syncedIds.length) await markSynced(syncedIds)
  return syncedIds
}
