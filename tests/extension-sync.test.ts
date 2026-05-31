import { describe, expect, it, vi } from 'vitest'
import { pushPendingItems } from '../extension/sync-core.js'

function item(id: number) {
  return { id, clientId: `capture-${id}`, type: 'link', url: `https://example.com/${id}` }
}

describe('browser extension outbox integration', () => {
  it('keeps captures pending while the desktop app is offline', async () => {
    const markSynced = vi.fn()
    const markFailed = vi.fn()
    const ids = await pushPendingItems({
      items: [item(1)],
      postItem: vi.fn().mockRejectedValue(new Error('offline')),
      markSynced,
      markFailed
    })

    expect(ids).toEqual([])
    expect(markSynced).not.toHaveBeenCalled()
    expect(markFailed).toHaveBeenCalledWith(1, expect.any(Error))
  })

  it('marks captures synced when the desktop app accepts them', async () => {
    const markSynced = vi.fn()
    const ids = await pushPendingItems({
      items: [item(1), item(2)],
      postItem: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
      markSynced,
      markFailed: vi.fn()
    })

    expect(ids).toEqual([1, 2])
    expect(markSynced).toHaveBeenCalledWith([1, 2])
  })

  it('does not mark a failed middle capture as synced', async () => {
    const markSynced = vi.fn()
    const markFailed = vi.fn()
    const postItem = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 })

    const ids = await pushPendingItems({
      items: [item(1), item(2), item(3)],
      postItem,
      markSynced,
      markFailed
    })

    expect(ids).toEqual([1, 3])
    expect(markSynced).toHaveBeenCalledWith([1, 3])
    expect(markFailed).toHaveBeenCalledWith(2, expect.any(Error))
  })

  it('syncs a pending capture after the desktop app reconnects', async () => {
    const pending = [item(1)]
    const markSynced = vi.fn((ids: number[]) => {
      for (const id of ids) pending.splice(pending.findIndex((entry) => entry.id === id), 1)
    })
    const markFailed = vi.fn()

    await pushPendingItems({
      items: [...pending],
      postItem: vi.fn().mockRejectedValue(new Error('offline')),
      markSynced,
      markFailed
    })
    expect(pending).toHaveLength(1)

    await pushPendingItems({
      items: [...pending],
      postItem: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
      markSynced,
      markFailed
    })
    expect(pending).toHaveLength(0)
  })
})
