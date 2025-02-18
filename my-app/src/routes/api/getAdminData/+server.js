import { db } from "$lib/database.js";

// @ts-ignore
export async function GET({ url }) {
  const prompt_id = url.searchParams.get("prompt_id");

  if (!prompt_id) {
    return new Response(
      JSON.stringify({
        message: "Prompt id needed to retrieve admin data",
      }),
      {
        status: 400,
      }
    );
  }

  console.log("PROMPT ID Retrieved from ADMINNNNNNNNNN:" + prompt_id);

  try {
    // Query to join Video, Comment, and Annotation tables based on the prompt_id
    const [rows] = await db.query(
      `SELECT 
        Prompt.prompt_type,
        Prompt.text,
        Article.url AS article_url, 
        Article.text AS text, 
        Annotation.true_value, 
        Annotation.predicted_value, 
        Annotation.annotation_id 
       FROM Prompt
       JOIN PromptWriter ON Prompt.writer_id = PromptWriter.id
       JOIN Article ON Prompt.prompt_id = Article.prompt_id
       JOIN Annotation ON Article.article_id = Annotation.article_id 
       WHERE Annotation.prompt_id = ? `,
      [prompt_id]
    );

    // @ts-ignore
    console.log("Sample of admin data:", rows.slice(0, 5));
    return new Response(JSON.stringify(rows), { status: 200 });
  } catch (error) {
    console.error("Error fetching examples:", error);
    return new Response(
      JSON.stringify({ message: "Failed to retrieve data" }),
      { status: 500 }
    );
  }
}
