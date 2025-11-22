import { createWorker, Worker } from "tesseract.js";

let worker: Worker | null = null;
export const getWorker = async () => {
  if (!worker) worker = await createWorker("eng", 1);
  return worker;
};
