import * as fs from 'fs'
import * as path from 'path'

const xml = fs.readFileSync(
  path.join(__dirname, 'data', 'SBLGNT-master', 'data', 'sblgnt', 'xml', 'Matt.xml'),
  'utf-8'
)
console.log(xml.substring(0, 2000))