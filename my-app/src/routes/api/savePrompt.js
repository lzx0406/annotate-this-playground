// src/routes/api/savePrompt.js
import { db } from "$lib/database";

// @ts-ignore
export async function POST({ request }) {
  // Parse the JSON body to get the prompt data
  const { promptText, userId } = await request.json();

  try {
    // Use the database connection pool to insert the prompt data
    const [result] = await db.execute(
      "INSERT INTO prompts (userId, promptText) VALUES (?, ?)",
      [userId, promptText]
    );

    // Respond with the new prompt's ID if insertion is successful
    return new Response(
      // @ts-ignore
      JSON.stringify({ success: true, promptId: result.insertId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Handle any database errors and respond with a failure message
    console.error("Error saving prompt:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to save prompt" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// // src/routes/api/savePrompt.js
// import { initDb, db } from '$lib/database';

// export async function POST({ request }) {
//   // Ensure the database connection pool is initialized
//   await initDb();

//   // Parse the JSON body to get the prompt data
//   const { promptText, userId } = await request.json();

//   try {
//     // Use a prepared statement to insert the prompt into the database
//     const [result] = await db.execute(
//       'INSERT INTO prompts (userId, promptText) VALUES (?, ?)',
//       [userId, promptText]
//     );

//     // Respond with the new prompt's ID if insertion is successful
//     return new Response(JSON.stringify({ success: true, promptId: result.insertId }), {
//       status: 200,
//       headers: { 'Content-Type': 'application/json' },
//     });
//   } catch (error) {
//     // Handle any database errors and respond with a failure message
//     console.error('Error saving prompt:', error);
//     return new Response(JSON.stringify({ success: false, error: 'Failed to save prompt' }), {
//       status: 500,
//       headers: { 'Content-Type': 'application/json' },
//     });
//   }
// }
