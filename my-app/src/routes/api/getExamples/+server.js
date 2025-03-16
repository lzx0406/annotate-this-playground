import { db } from "$lib/database.js";

// @ts-ignore
export async function GET({ url }) {
  const promptId = url.searchParams.get("prompt_id");
  const writerId = url.searchParams.get("writer_id"); // Get writer ID from query params

  if (!promptId || !writerId) {
    return new Response(
      JSON.stringify({ message: "Prompt ID and Writer ID are required" }),
      {
        status: 400,
      }
    );
  }

  try {
    console.log("IDSSSSS" + writerId, promptId);
    // Get the next four available prompt_ids that belong to the same writer
    const [promptRows] = await db.query(
      `SELECT DISTINCT prompt_id 
       FROM Prompt 
       WHERE writer_id = ? AND prompt_id >= ? 
       ORDER BY prompt_id ASC 
       LIMIT 5`,
      [writerId, promptId]
    );

    // @ts-ignore
    if (promptRows.length === 0) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    // Extract prompt IDs from results
    // @ts-ignore
    const promptIds = promptRows.map((row) => row.prompt_id);
    console.log("Prompt ids:" + promptIds);

    // Fetch annotations and related articles for the selected prompt IDs
    const [rows] = await db.query(
      `SELECT 
        Article.article_id AS article_id,
        Article.url AS article_url, 
        Article.text AS text, 
        Annotation.true_value, 
        Annotation.predicted_value,
        Annotation.probability,
        Annotation.confidence,
        Annotation.explanation,
        Annotation.annotation_id,
        Annotation.perturbation_index 
       FROM Article 
       JOIN Annotation ON Article.article_id = Annotation.article_id 
       WHERE Annotation.prompt_id IN (?)
       ORDER BY Annotation.perturbation_index ASC`,
      [promptIds]
    );

    return new Response(JSON.stringify(rows), { status: 200 });
  } catch (error) {
    console.error("Error fetching examples:", error);
    return new Response(
      JSON.stringify({ message: "Failed to retrieve data" }),
      { status: 500 }
    );
  }
}
