import * as fs from 'fs'
import * as path from 'path'

const raw = fs.readFileSync(
  path.join(__dirname, 'data', 'FreCrampon.json'),
  'utf-8'
)

const data = JSON.parse(raw)

console.log('=== TYPE ===')
console.log(typeof data, Array.isArray(data))

console.log('=== PREMIER ÉLÉMENT ===')
console.log(JSON.stringify(data[0] || data).substring(0, 500))

console.log('=== CLÉS ===')
if (Array.isArray(data)) {
  console.log(Object.keys(data[0]))
} else {
  console.log(Object.keys(data))
}