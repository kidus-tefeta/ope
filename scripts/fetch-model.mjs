/* THE MODEL THAT SHIPS WITH OPE. Project 6.5.
 *
 * OPE Chat used to ask people to install Ollama and pull 1.9 GB before it
 * would answer anything, and on Windows that is where most of them stopped.
 * So the Windows build carries its own brain: Qwen2.5 Coder 1.5B, quantised to
 * four bits, a little over a gigabyte. Nothing to install, no tray app, no
 * service to be running.
 *
 * This script puts that file in build/model before the installer is made. It
 * resumes a half finished download, refuses a file that came back the wrong
 * size, and does nothing at all if the model is already there.
 *
 *   node scripts/fetch-model.mjs            # fetch it if it is missing
 *   node scripts/fetch-model.mjs --force    # fetch it again from the start
 *
 * Ollama stays optional. Anyone who has it keeps the bigger 3B model, and OPE
 * says which brain answered.
 */

import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

export const MODEL = {
  file: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
  url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
  bytes: 1117320768,                       // checked 20 Sep 2026
  name: 'Qwen2.5 Coder 1.5B',
  licence: 'Apache 2.0'
}
export const modelDir = () => join(ROOT, 'build', 'model')
export const modelPath = () => join(modelDir(), MODEL.file)

/* Is the model here, and is it the whole thing? A file that is short is a
   download that died, not a model. */
export function haveModel(p = modelPath()) {
  try { return statSync(p).size === MODEL.bytes } catch (e) { return false }
}

const mb = (n) => (n / 1048576).toFixed(0) + ' MB'

export async function fetchModel({ force = false, onProgress } = {}) {
  mkdirSync(modelDir(), { recursive: true })
  const out = modelPath()
  const part = out + '.part'
  if (!force && haveModel(out)) return { path: out, already: true }
  if (force && existsSync(part)) unlinkSync(part)

  let from = 0
  if (existsSync(part)) from = statSync(part).size        // carry on where it stopped
  if (from >= MODEL.bytes) { renameSync(part, out); return { path: out, already: false } }

  const res = await fetch(MODEL.url, from ? { headers: { Range: 'bytes=' + from + '-' } } : undefined)
  if (!res.ok && res.status !== 206) throw new Error('The model could not be downloaded: ' + res.status + ' ' + res.statusText)
  const total = MODEL.bytes
  let got = from
  const tick = (chunk) => {
    got += chunk.length
    if (onProgress) onProgress({ got, total })
    else if (got % (32 * 1048576) < chunk.length) process.stdout.write('\r  ' + mb(got) + ' of ' + mb(total) + '   ')
  }
  const body = Readable.fromWeb(res.body)
  body.on('data', tick)
  await pipeline(body, createWriteStream(part, { flags: from ? 'a' : 'w' }))

  const size = statSync(part).size
  if (size !== MODEL.bytes) {
    throw new Error('The model came back the wrong size (' + size + ' bytes, expected ' + MODEL.bytes + '). Run it again: it carries on where it stopped.')
  }
  renameSync(part, out)
  if (!onProgress) process.stdout.write('\n')
  return { path: out, already: false }
}

/* run directly: node scripts/fetch-model.mjs */
if (process.argv[1] && process.argv[1].endsWith('fetch-model.mjs')) {
  const force = process.argv.includes('--force')
  if (!force && haveModel()) {
    console.log('The model is already here: ' + modelPath())
    process.exit(0)
  }
  console.log(MODEL.name + ', ' + mb(MODEL.bytes) + ', ' + MODEL.licence)
  fetchModel({ force })
    .then((r) => console.log('Ready: ' + r.path))
    .catch((e) => { console.error(String(e.message || e)); process.exit(1) })
}
