// neoTester.js  ────────────────────────────────────────────
import neo4j  from 'neo4j-driver';
import dotenv from 'dotenv';
import path   from 'path';
import { fileURLToPath } from 'url';

/* ── .env one directory up (server/.env) ────────────────── */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/* ── driver ─────────────────────────────────────────────── */
const driver = neo4j.driver(
  process.env.NEO_URI,
  neo4j.auth.basic(process.env.NEO_USER, process.env.NEO_PASSWORD),
  { encrypted: 'ENCRYPTION_OFF' }
);
const session = driver.session({ database: process.env.NEO_DATABASE });

/* ── 🔧 Editable search lists ───────────────────────────── */
const DISORDERS = [
  'stuttering'
];

// [
//   "apraxia of speech",
//   "Autism Spectrum Disorder (ASD)",
//   "Breathing Pattern Disorder",
//   "CCN (Complex Communication Needs)",
//   "Children with cleft lip and palate (CLP)",
//   "Children with non-cleft speech disorders",
//   "Cleft Lip and Palate (CLP) speech disorders",
//   "Cleft Speech Disorders (CSCs)",
//   "Cognitive disorders",
//   "Communication disorders",
//   "Developmental disorders",
//   "Developmental Disorders (DD)",
//   "dysarthria",
//   "Dysphagia",
//   "Early stuttering",
//   "functional phonological disorder",
//   "IDD (Intellectual and Developmental Disabilities)",
//   "ILO (Inspiratory / Inducible Laryngeal Obstruction)",
//   "Language disorders",
//   "Limited functional mands",
//   "neurodevelopmental disorders",
//   "phonological delay",
//   "phonological disorder",
//   "Phonologically based speech-sound disorders",
//   "post-stroke dysarthria",
//   "seizure disorder",
//   "speech",
//   "Speech and language disorders",
//   "Speech disorders",
//   "Speech sound disorders",
//   "stereotypy",
//   "Stuttering",
//   "sulcus vocalis",
//   "swallowing",
//   "Voice disorders"
// ]

const KEYWORDS  = [
  'expressive language development'
  // 'linguistic concept',
  // … add more
];

/* ── Cypher templates (parameterised) ───────────────────── */
const CYPHER_WITH_KW = `
MATCH (intervention:Intervention)-[rel:Target_At]-(disorder:Disorder)
WHERE any(n IN $disorders WHERE toLower(disorder.name) CONTAINS n)
  AND any(k IN $keywords
          WHERE toLower(intervention.Description) CONTAINS k
             OR toLower(intervention.Procedure)  CONTAINS k)
RETURN intervention AS intervention, rel AS rel, disorder AS disorder LIMIT 5`;

const CYPHER_NO_KW = `
MATCH (intervention:Intervention)-[rel:Target_At]-(disorder:Disorder)
WHERE any(n IN $disorders WHERE toLower(disorder.name) CONTAINS n)
RETURN intervention AS intervention, rel AS rel, disorder AS disorder LIMIT 5`;

/* ── tiny helpers ───────────────────────────────────────── */
const wrap  = (t,w=78)=>t?.match(new RegExp(`(.{1,${w}})(\\s|$)`,'g'))?.join('\n');
const trunc = s=>s.length>60?s.slice(0,57)+'…':s;
function pretty(rec){
  const d=rec.get('disorder').properties;
  const i=rec.get('intervention').properties;
  const r=rec.get('rel');

  console.log(d);
    console.log('─'.repeat(80));
    console.log(i);
    console.log('─'.repeat(80));
    console.log(r);
    
//   console.log('\n🟡 DISORDER\n  name        :',d.name);
//   if(d.description) console.log('  description :',wrap(d.description));
//   console.log('\n🟢 INTERVENTION\n  Name        :',i.Name,'\n  Source      :',i.Source||'');
//   if(i.Description) console.log('  Description :',wrap(i.Description));
//   console.log('\n🔵 RELATIONSHIP\n  type        :',r.type,
//               '\n  start node  :',trunc(JSON.stringify(r.startNodeElementId)),
//               '\n  end node    :',trunc(JSON.stringify(r.endNodeElementId)),
//               '\n'+'─'.repeat(80));
}

/* ── run: Query A then fallback to Query B if empty ─────── */
(async()=>{
  try{
    const params = {
      disorders: DISORDERS.map(s=>s.toLowerCase()),
      keywords : KEYWORDS .map(s=>s.toLowerCase())
    };

    console.log('\n========= QUERY A  (disorder + keyword) =========');
    const resA = await session.run(CYPHER_WITH_KW, params);
    if (resA.records.length) {
      resA.records.forEach(pretty);
    } else {
      console.log('No rows → falling back to disorder-only search.');
      const resB = await session.run(CYPHER_NO_KW, { disorders: params.disorders });
      resB.records.forEach(pretty);
    }

  }catch(e){
    console.error('⚠ Neo4j error:', e.code, e.message);
  }finally{
    await session.close();
    await driver.close();
  }
})();
