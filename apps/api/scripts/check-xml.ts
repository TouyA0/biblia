import * as fs from 'fs'
import * as path from 'path'

const xml = fs.readFileSync(
  path.join(__dirname, 'data', 'morphhb-master', 'wlc', 'Gen.xml'),
  'utf-8'
)
// Chercher le premier chapitre et verset
const chapterIndex = xml.indexOf('<chapter ')
const verseIndex = xml.indexOf('<verse ')
const wordIndex = xml.indexOf('<w ')

console.log('=== PREMIER CHAPITRE ===')
console.log(xml.substring(chapterIndex, chapterIndex + 200))
console.log('=== PREMIER VERSET ===')
console.log(xml.substring(verseIndex, verseIndex + 200))
console.log('=== PREMIER MOT ===')
console.log(xml.substring(wordIndex, wordIndex + 300))