import bcrypt from "bcrypt";
import { db } from "$lib/database.js";

// @ts-ignore
export async function POST({ request }) {
  // await initDb(); // Ensure the database is initialized

  const { username, email, role, password } = await request.json();

  // Hash the password with bcrypt
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  try {
    // Insert the user into the PromptWriter table
    await db.query(
      "INSERT INTO PromptWriter (name, email, role, password) VALUES (?, ?, ?, ?)",
      [username, email, role, hashedPassword]
    );

    return new Response(
      JSON.stringify({ message: "Account created successfully!" }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inserting user:", error);
    return new Response(
      JSON.stringify({
        message:
          "Sign up failed. Please try again. Note that each account is identified by unique email. If the error persists, please try again later.",
      }),
      { status: 500 }
    );
  }
}
