import * as fs from 'fs'
import * as path from 'path'
import { XMLParser } from 'fast-xml-parser'

const xml = fs.readFileSync(
  path.join(__dirname, 'data', 'morphhb-master', 'wlc', 'Gen.xml'),
  'utf-8'
)

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: () => false,
})

const result = parser.parse(xml)
const osisText = result?.osis?.osisText
const div = osisText?.div

console.log('=== TYPE DE DIV ===')
console.log(typeof div, Array.isArray(div))

console.log('=== CLÉS DE DIV ===')
if (div) console.log(Object.keys(div))

console.log('=== DIV[0] ou DIV ===')
const first = Array.isArray(div) ? div[0] : div
if (first) console.log(JSON.stringify(first).substring(0, 800))