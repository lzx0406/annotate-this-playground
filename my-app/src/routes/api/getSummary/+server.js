import { db } from "$lib/database.js";
import { get } from "svelte/store";

import fs from "fs";
import OpenAI, { toFile } from "openai";

const apiKey = "";

const openai = new OpenAI({
  apiKey,
});

// @ts-ignore
export async function POST({ request }) {
  try {
    const { examples } = await request.json();
    console.log("🛑 Debug: exampleData RECEIVED:", examples.slice(0, 5));

    if (!examples || examples.length === 0) {
      return new Response(JSON.stringify({ message: "No examples provided" }), {
        status: 400,
      });
    }

    // const formattedExamples = examples
    //   .map(
    //     (
    //       /** @type {{ text: any; predicted_value: any; explanation: any; }} */ ex,
    //       /** @type {number} */ index
    //     ) =>
    //       `Example ${index + 1}:\nPrediction: ${
    //         ex.predicted_value ? "Yes" : "No"
    //       }\nExplanation: ${ex.explanation}\n`,
    //     console.log(examples.explanation)
    //   )
    //   .join("\n\n");

    const filteredExamples = examples
      .filter(
        (/** @type {{ explanation: null | undefined; }} */ ex) =>
          ex.explanation !== undefined && ex.explanation !== null
      )
      .map(
        (
          /** @type {{ predicted_value: any; explanation: any; }} */ ex,
          /** @type {number} */ index
        ) =>
          `Example ${index + 1}:\nPrediction: ${
            ex.predicted_value ? "Yes" : "No"
          }\nExplanation: ${ex.explanation}\n`
      )
      .join("\n\n");

    if (filteredExamples.length === 0) {
      return new Response(
        JSON.stringify({
          summary: "No valid explanations available to summarize.",
        }),
        { status: 200 }
      );
    }

    const prompt = `Summarize the following AI-generated EXPLANATIONS. The task was to predict whether an article contains hard news, AI predictions are included for context:\n\n${filteredExamples}`;

    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini-2024-07-18",
      // @ts-ignore
      messages: [
        { role: "system", content: "You are a helpful AI summarizer." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    return new Response(
      JSON.stringify({ summary: gptResponse.choices[0].message.content }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error summarizing explanations:", error);
    return new Response(
      JSON.stringify({ message: "Failed to summarize explanations" }),
      { status: 500 }
    );
  }
}
