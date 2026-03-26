import * as fs from 'fs'
import * as path from 'path'

const raw = fs.readFileSync(
  path.join(__dirname, 'data', 'FreLXXGiguet.json'),
  'utf-8'
)

const data = JSON.parse(raw)
console.log('=== CLÉS ===')
console.log(Object.keys(data))

console.log('=== NOMBRE DE LIVRES ===')
console.log(data.books?.length)

console.log('=== LISTE DES LIVRES ===')
data.books?.forEach((b: any) => console.log(b.name))