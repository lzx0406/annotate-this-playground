// src/routes/login/+server.js
import bcrypt from "bcrypt";
import { db } from "$lib/database.js";

// @ts-ignore
export async function POST({ request }) {
  const { email, password } = await request.json();

  try {
    // Fetch the user from the PromptWriter table by email
    const [rows] = await db.query(
      "SELECT id, name, password FROM PromptWriter WHERE email = ?",
      [email]
    );

    // @ts-ignore
    if (rows.length === 0) {
      // User not found
      return new Response(
        JSON.stringify({ message: "Invalid email or password." }),
        { status: 401 }
      );
    }

    // @ts-ignore
    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      // Password does not match
      return new Response(
        JSON.stringify({ message: "Invalid email or password." }),
        { status: 401 }
      );
    }

    // Login successful - You may set a session here if you’re using session-based authentication
    return new Response(
      JSON.stringify({
        message: "Login successful!",
        userId: user.id,
        userName: user.name,
      }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error during login:", error);
    return new Response(
      JSON.stringify({ message: "Login failed. Please try again." }),
      { status: 500 }
    );
  }
}
