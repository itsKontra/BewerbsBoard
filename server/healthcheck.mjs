import { readFile, unlink, writeFile } from 'node:fs/promises'

const statePath = '/tmp/healthcheck-successes'

try {
  const response = await fetch('http://127.0.0.1:8080/healthz')
  if (!response.ok) throw new Error(`Health endpoint returned ${response.status}`)

  const successes = await previousSuccesses() + 1
  await writeFile(statePath, String(successes))
  process.exit(successes >= 3 ? 0 : 1)
} catch {
  await unlink(statePath).catch(() => undefined)
  process.exit(1)
}

async function previousSuccesses() {
  try {
    const value = Number(await readFile(statePath, 'utf8'))
    return Number.isInteger(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}
