import Tesseract from 'tesseract.js'
import { itemQueries } from './db'

// ── Singleton worker + bounded queue ─────────────────────────────────────────
// A single worker stays alive to avoid spawning a new process per image.
// Tasks are queued and processed one at a time to keep memory usage low.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _worker: any | null = null
let _workerBusy = false
const _queue: Array<() => Promise<void>> = []

async function getWorker() {
  if (!_worker) {
    _worker = await Tesseract.createWorker('eng+spa', 1, { logger: () => {} })
  }
  return _worker
}

async function drainQueue() {
  if (_workerBusy || _queue.length === 0) return
  _workerBusy = true
  while (_queue.length > 0) {
    const task = _queue.shift()!
    try {
      await task()
    } catch (err) {
      console.error('[OCR] task failed:', err)
    }
  }
  _workerBusy = false
}

export function processImageOcr(itemId: number, imagePath: string): void {
  _queue.push(async () => {
    try {
      const worker = await getWorker()
      const { data: { text } } = await worker.recognize(imagePath)
      const clean = text.trim()
      if (clean.length > 5) {
        itemQueries.update(itemId, { content: clean })
      }
    } catch (err) {
      console.error('[OCR] failed for image:', imagePath, err)
    }
  })
  drainQueue()
}

// Call on app quit to cleanly terminate the worker process
export async function shutdownOcrWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate().catch(() => {})
    _worker = null
  }
}
