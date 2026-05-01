import Tesseract from 'tesseract.js'
import { itemQueries } from './db'

// We run OCR in the background so it doesn't block the UI
export async function processImageOcr(itemId: number, imagePath: string) {
  try {
    const worker = await Tesseract.createWorker('eng+spa', 1, {
      logger: m => console.log(m)
    });
    const { data: { text } } = await worker.recognize(imagePath);
    await worker.terminate();

    const cleanText = text.trim();
    if (cleanText.length > 5) {
      // Update the item's content with the recognized text so FTS4 can index it!
      itemQueries.update(itemId, { content: cleanText });
    }
  } catch (err) {
    console.error('OCR failed for image:', imagePath, err);
  }
}
