import { createWorker } from "tesseract.js";

let worker = null;

export const getWorker = async () => {
  if (!worker) worker = await createWorker("eng", 1);
  return worker;
};

