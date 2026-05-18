import { createReadStream, createWriteStream, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createGzip } from 'node:zlib'

const DIST_DIR = join(import.meta.dirname, '../dist')
const EXTENSIONS = new Set(['.js', '.css', '.html', '.json', '.svg'])
const MIN_SIZE = 1024

function walkDir(dir: string, files: string[] = []) {
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name)
    if (statSync(fullPath).isDirectory()) {
      walkDir(fullPath, files)
    } else {
      files.push(fullPath)
    }
  }
  return files
}

function gzipFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = createReadStream(filePath)
    const output = createWriteStream(`${filePath}.gz`)
    const gzip = createGzip({ level: 9 })
    input.pipe(gzip).pipe(output)
    output.on('finish', resolve)
    output.on('error', reject)
  })
}

async function main() {
  const files = walkDir(DIST_DIR)
  let count = 0
  for (const file of files) {
    const ext = file.slice(file.lastIndexOf('.'))
    if (!EXTENSIONS.has(ext)) continue
    if (statSync(file).size < MIN_SIZE) continue
    await gzipFile(file)
    count++
  }
  console.log(`gzip: compressed ${count} files in dist/`)
}

main().catch((err) => { console.error(err); process.exit(1) })
