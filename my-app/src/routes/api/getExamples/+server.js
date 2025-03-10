import { db } from "$lib/database.js";

// @ts-ignore
export async function GET({ url }) {
  const promptId = url.searchParams.get("prompt_id");

  if (!promptId) {
    return new Response(JSON.stringify({ message: "Prompt ID is required" }), {
      status: 400,
    });
  }

  try {
    // Query to join Video, Comment, and Annotation tables based on the prompt_id
    const [rows] = await db.query(
      `SELECT 
        Article.url AS article_url, 
        Article.text AS text, 
        Annotation.true_value, 
        Annotation.predicted_value,
        Annotation.annotation_id 
       FROM Article 
       JOIN Annotation ON Article.article_id = Annotation.article_id 
       WHERE Annotation.prompt_id = ?`,
      [promptId]
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
