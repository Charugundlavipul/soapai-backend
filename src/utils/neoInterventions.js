// server/src/utils/neoInterventions.js
import neo4j from "neo4j-driver";
import path  from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/* ─── Neo4j driver (re-use one global connection) ─── */
const driver = neo4j.driver(
  process.env.NEO_URI,
  neo4j.auth.basic(process.env.NEO_USER, process.env.NEO_PASSWORD),
  { encrypted: "ENCRYPTION_OFF" }
);

/* ─── Cypher templates ─── */
const CYPHER_WITH_KW = `
MATCH (i:Intervention)-[r:Target_At]-(d:Disorder)
WHERE any(n IN $disorders WHERE toLower(d.name) CONTAINS n)
  AND any(k IN $keywords
          WHERE toLower(i.Description) CONTAINS k
             OR toLower(i.Procedure)  CONTAINS k)
RETURN i AS intervention, d AS disorder
LIMIT 5`;

const CYPHER_NO_KW = `
MATCH (i:Intervention)-[r:Target_At]-(d:Disorder)
WHERE any(n IN $disorders WHERE toLower(d.name) CONTAINS n)
RETURN i AS intervention, d AS disorder
LIMIT 5`;

/* ─── Main helper ─── */
export async function getInterventions({
  disorders = [],
  keywords  = [],
  limit     = 5,
}) {
  if (!Array.isArray(disorders) || !disorders.length) return [];

  const session = driver.session({ database: process.env.NEO_DATABASE });
  const params  = {
    disorders: disorders.map((s) => s.toLowerCase()),
    keywords : (keywords || []).map((s) => s.toLowerCase()),
    limit,
  };

  try {
    const res = await session.run(
      keywords?.length ? CYPHER_WITH_KW : CYPHER_NO_KW,
      params
    );
    return res.records.map((rec) => {
      const i = rec.get("intervention").properties;
      const d = rec.get("disorder").properties;
      console.log("Intervention:", i.Name, "→ Disorder:", d.name);
      return {
        name       : i.Name || i.name || "Unnamed intervention",
        description: i.Description || "",
        procedure  : i.Procedure  || "",
        targetDisorder: d.name || "",
        source     : i.Source || "",
      };
      
    });
  }
  catch (err) {
    console.error("Error fetching interventions:", err);
    return [];
  }
  finally {
    await session.close();          // keep driver, close only session
  }
}

process.on("exit", () => driver.close());
