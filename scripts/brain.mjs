/* THE BRAIN THAT NEEDS NOTHING INSTALLED. Project 6.5.
 *
 * OPE Chat has three ways to answer, and it takes the first one that is there:
 *
 *   1. Ollama, if the person already runs it. Bigger model, best answers.
 *   2. The model that ships inside OPE (Qwen2.5 Coder 1.5B), run by llama.cpp
 *      through node-llama-cpp. Nothing to install, nothing to download.
 *   3. Nothing, and OPE says so in a sentence instead of pretending.
 *
 * The model is loaded once and kept, because loading it is the slow part. It is
 * unloaded when nobody has asked anything for a while, so a browser window left
 * open overnight is not holding a gigabyte.
 */

import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const IDLE_MS = 10 * 60 * 1000          // ten quiet minutes and the model is let go

/* Where the model lives: inside the packaged app first, then the repo's build
   folder for anyone running from source. */
export function modelFile(explicit) {
  const name = 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf'
  const tries = [
    explicit,
    process.env.OPE_MODEL,
    process.resourcesPath ? join(process.resourcesPath, 'model', name) : null,
    join(HERE, '..', 'build', 'model', name)
  ].filter(Boolean)
  for (const p of tries) { try { if (existsSync(p) && statSync(p).size > 100 * 1048576) return p } catch (e) {} }
  return null
}

let mod = null            // the node-llama-cpp module, loaded the first time
let ctx = null            // { llama, model, context, session, path }
let idle = null

async function llama() {
  if (!mod) mod = await import('node-llama-cpp')
  return mod
}

function keepAlive() {
  clearTimeout(idle)
  idle = setTimeout(() => { release() }, IDLE_MS)
  if (idle.unref) idle.unref()
}

export function release() {
  clearTimeout(idle)
  const old = ctx
  ctx = null
  if (!old) return
  try { old.context && old.context.dispose && old.context.dispose() } catch (e) {}
  try { old.model && old.model.dispose && old.model.dispose() } catch (e) {}
}

export function haveBrain(explicit) { return !!modelFile(explicit) }

async function open(explicit) {
  const path = modelFile(explicit)
  if (!path) throw new Error('no model')
  if (ctx && ctx.path === path) return ctx
  release()
  const { getLlama, LlamaChatSession } = await llama()
  const l = await getLlama()
  const model = await l.loadModel({ modelPath: path })
  const context = await model.createContext({ contextSize: 4096 })
  ctx = { llama: l, model, context, path }
  return ctx
}

/* One question, one answer. Every call starts a clean conversation, because
   OPE Chat explains a file: it is not a chat that has to remember yesterday. */
export async function ask(system, prompt, { maxTokens = 700, onToken } = {}) {
  const c = await open()
  const { LlamaChatSession } = await llama()
  /* one sequence per question, handed back at the end. A context holds a fixed
     number of them, so a sequence that is never given back is a browser that
     answers once and then says it has none left. */
  const seq = c.context.getSequence()
  try {
    const session = new LlamaChatSession({ contextSequence: seq, systemPrompt: String(system || '') })
    keepAlive()
    const answer = await session.prompt(String(prompt || ''), {
      maxTokens,
      temperature: 0.2,
      onTextChunk: onToken ? (t) => onToken(t) : undefined
    })
    keepAlive()
    return String(answer || '').trim()
  } finally {
    try { seq.dispose() } catch (e) {}
  }
}

export const BRAIN = { name: 'Qwen2.5 Coder 1.5B', label: 'Qwen2.5 Coder 1.5B, inside OPE' }
