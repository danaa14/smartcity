import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), ".data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

let queue: Promise<unknown> = Promise.resolve();

/** Serialises writes so concurrent requests cannot clobber the JSON file. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(name: string, data: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, name);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 1));
  await fs.rename(tmp, file);
}

export function collection<T extends { id: string }>(name: string) {
  const file = `${name}.json`;
  return {
    all: () => readJson<T[]>(file, []),
    get: async (id: string) => (await readJson<T[]>(file, [])).find((x) => x.id === id) ?? null,
    insert: (item: T) =>
      locked(async () => {
        const items = await readJson<T[]>(file, []);
        items.unshift(item);
        await writeJson(file, items);
        return item;
      }),
    update: (id: string, patch: Partial<T>) =>
      locked(async () => {
        const items = await readJson<T[]>(file, []);
        const i = items.findIndex((x) => x.id === id);
        if (i < 0) return null;
        items[i] = { ...items[i], ...patch };
        await writeJson(file, items);
        return items[i];
      }),
    remove: (id: string) =>
      locked(async () => {
        const items = await readJson<T[]>(file, []);
        const next = items.filter((x) => x.id !== id);
        await writeJson(file, next);
        return next.length !== items.length;
      }),
  };
}
