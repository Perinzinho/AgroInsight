import { afterEach, describe, expect, it } from 'vitest'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createDatasetStore } from '../data/loadDataset'
import { appRoot, readConfig } from '../config'
import { dataDir } from './helpers'

const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    // mkdtemp returns an absolute path; only delete verified test directories under the named temp root.
    if (!directory.startsWith(resolve(tmpdir(), 'agroinsight-test-'))) throw new Error('Unexpected temporary path')
    await rm(directory, { recursive: true, force: true })
  }
})
describe('snapshot e configuração', () => {
  it('resolve dados contra FrontEnd e rejeita portas reservadas/configuração inválida', () => {
    expect(readConfig({}).dataDir).toBe(resolve(appRoot, 'public/data'))
    for (const port of ['4200', '8000', 'NaN', '0']) expect(() => readConfig({ AI_PORT: port })).toThrow()
    expect(readConfig({}).AI_HOST).toBe('127.0.0.1')
    expect(readConfig({ AI_HOST: '0.0.0.0' }).AI_HOST).toBe('0.0.0.0')
    expect(() => readConfig({ AI_HOST: 'external.example' })).toThrow()
    expect(() => readConfig({ AI_MAX_TOOL_CALLS: '0' })).toThrow()
  })
  it('reutiliza snapshot e substitui apenas após validação completa', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'agroinsight-test-'))
    directories.push(directory)
    await mkdir(resolve(directory, 'data'))
    await cp(dataDir, resolve(directory, 'data'), { recursive: true })
    const store = createDatasetStore(resolve(directory, 'data'))
    const first = await store.get()
    expect(await store.get()).toBe(first)
    const path = resolve(directory, 'data/manifest.json')
    const original = await readFile(path, 'utf8')
    await writeFile(path, '{invalid')
    await expect(store.get()).rejects.toMatchObject({ code: 'DATA_UNAVAILABLE' })
    expect(first.manifest.generatedAt).toBeTruthy()
    const updated = JSON.parse(original)
    updated.generatedAt = '2026-10-27T12:00:00.000Z'
    await writeFile(path, JSON.stringify(updated))
    const second = await store.get()
    expect(second).not.toBe(first)
    expect(second.manifest.generatedAt).toBe(updated.generatedAt)
    expect(first.manifest.generatedAt).not.toBe(updated.generatedAt)
  })
})
