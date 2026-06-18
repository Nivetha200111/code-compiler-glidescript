// One-shot Cloudflare deploy: provisions D1, wires the binding, applies the
// schema, builds, and deploys to Pages. Run it in a terminal that is
// authenticated to Cloudflare (either `wrangler login` OAuth, or
// CLOUDFLARE_API_TOKEN set):   node scripts/deploy-cloudflare.mjs
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const DB_NAME = 'glidescript-playground'
const PROJECT = 'glidescript-playground'

function run(cmd) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { cwd: root, stdio: 'inherit', env: process.env })
}
function capture(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', env: process.env, stdio: ['inherit', 'pipe', 'inherit'] })
}
function tryRun(cmd, why) {
  try {
    run(cmd)
  } catch {
    console.log(`  (continuing - ${why})`)
  }
}

// Confirm we're authenticated. Works with either a stored `wrangler login`
// OAuth session or an API token in CLOUDFLARE_API_TOKEN.
try {
  execSync('npx wrangler whoami', { cwd: root, stdio: 'ignore', env: process.env })
} catch {
  console.error('Not authenticated to Cloudflare.')
  console.error('Run `npx wrangler login`, or set CLOUDFLARE_API_TOKEN in this terminal, then re-run.')
  process.exit(1)
}

console.log('\nStep 1/6 - ensuring the D1 database exists...')
tryRun(`npx wrangler d1 create ${DB_NAME}`, 'database likely already exists')

console.log('\nStep 2/6 - resolving the database id...')
const raw = capture('npx wrangler d1 list --json')
const json = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
const list = JSON.parse(json)
const row = list.find((d) => d.name === DB_NAME)
if (!row) {
  console.error(`Could not find a D1 database named "${DB_NAME}".`)
  process.exit(1)
}
const databaseId = row.uuid || row.database_id || row.id
console.log(`  database_id = ${databaseId}`)

console.log('\nStep 3/6 - writing the D1 binding into wrangler.toml...')
const tomlPath = join(root, 'wrangler.toml')
let toml = readFileSync(tomlPath, 'utf8')
// Drop any prior d1 section (commented template or a real one) then append a fresh block.
toml = toml.replace(/\r?\n# D1 binding[\s\S]*$/, '').replace(/\r?\n\[\[d1_databases\]\][\s\S]*$/, '')
toml = `${toml.trimEnd()}\n\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "${DB_NAME}"\ndatabase_id = "${databaseId}"\n`
writeFileSync(tomlPath, toml)
console.log('  wrangler.toml updated')

console.log('\nStep 4/6 - applying the schema to the remote database...')
run(`npx wrangler d1 execute ${DB_NAME} --file db/schema.sql --remote -y`)

console.log('\nStep 5/7 - ensuring the Pages project exists...')
tryRun(`npx wrangler pages project create ${PROJECT} --production-branch main`, 'project likely already exists')

console.log('\nStep 6/7 - ensuring SESSION_SECRET is set (signs login sessions)...')
let secretList = ''
try {
  secretList = capture(`npx wrangler pages secret list --project-name ${PROJECT}`)
} catch {
  // no secrets yet
}
if (secretList.includes('SESSION_SECRET')) {
  console.log('  SESSION_SECRET already set (left unchanged so existing logins survive)')
} else {
  const secret = randomBytes(32).toString('hex')
  execSync(`npx wrangler pages secret put SESSION_SECRET --project-name ${PROJECT}`, {
    cwd: root,
    env: process.env,
    input: `${secret}\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  console.log('  SESSION_SECRET created')
}

console.log('\nStep 7/7 - building and deploying to Cloudflare Pages...')
run('npm run build')
run(`npx wrangler pages deploy dist --project-name ${PROJECT} --commit-dirty=true`)

console.log('\nDone. Your site is live at the *.pages.dev URL printed just above.')
console.log('Next: set up Cloudflare Access (login) in the Zero Trust dashboard - see docs/cloudflare.md.')
