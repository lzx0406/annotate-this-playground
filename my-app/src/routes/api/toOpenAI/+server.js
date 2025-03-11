import { db } from "$lib/database.js"; // Ensure this file provides a MySQL connection with transaction support
import { exec } from "child_process"; // To run CLI commands
import path from "path";
import { get } from "svelte/store";

import fs from "fs";
import fetch from "node-fetch";
import OpenAI, { toFile } from "openai";
import {
  waitingForAnnotation,
  pendingPrompt,
  selectedAnnotationType,
  userId,
  userName,
  prompts,
  latestProgress,
} from "$lib/stores";
import { faQuestion } from "@fortawesome/free-solid-svg-icons";

// Set the OpenAI API key
const apiKey = "";

const openai = new OpenAI({
  apiKey,
});

/**
 * @param {string} responseText
 */
// function parseResponse(responseText) {
//   console.log(responseText);
//   const firstWord = responseText.trim().toLowerCase().split(/\s+/)[0]; // Get the first word

//   if (["yes", "true", "1"].includes(firstWord)) {
//     return "true";
//   } else if (["no", "false", "0", "vague"].includes(firstWord)) {
//     return "false";
//   } else {
//     console.warn(
//       `Warning: Unexpected response format: '${responseText}'. Expected first word to be 'Yes' or 'No'. Defaulting to 'false'.`
//     );
//     return "false";
//   }
// }

// function parseResponse(responseText) {
//   console.log(responseText);

//   const g1Match = responseText.match(/G1:\s*(.+)/i);

//   if (g1Match) {
//     const g1Answer = g1Match[1].trim().toLowerCase();

//     if (["yes", "true", "1"].includes(g1Answer)) {
//       return "true";
//     } else if (["no", "false", "0", "vague"].includes(g1Answer)) {
//       return "false";
//     } else {
//       console.warn(
//         `Warning: G1 answer '${g1Answer}' is unexpected. Expected 'Yes' or 'No'. Defaulting to 'false'.`
//       );
//       return "false";
//     }
//   } else {
//     console.warn(`Warning: G1 not found in response. Defaulting to 'false'.`);
//     return "false";
//   }
// }

function parseResponse(responseText) {
  console.log(responseText);

  const g1Match = responseText.match(/G1:\s*(.+)/i);
  const p1Match = responseText.match(/P1:\s*([\d.]+)/i);
  const confidenceMatch = responseText.match(/Confidence:\s*(.+)/i);

  let g1Answer = "false"; // Default value
  let probability = null;
  let confidence = null;

  if (g1Match) {
    g1Answer = g1Match[1].trim().toLowerCase();
    if (["yes", "true", "1"].includes(g1Answer)) {
      g1Answer = "true";
    } else if (["no", "false", "0", "vague"].includes(g1Answer)) {
      g1Answer = "false";
    } else {
      console.warn(
        `Unexpected G1 value: '${g1Answer}', defaulting to 'false'.`
      );
      g1Answer = "false";
    }
  }

  if (p1Match) {
    probability = parseFloat(p1Match[1]); // Extract numerical probability
  }

  if (confidenceMatch) {
    confidence = confidenceMatch[1].trim(); // Extract verbal confidence
  }

  return { prediction: g1Answer, probability, confidence };
}

/**
 * @param {any[]} dataset
 * @param {fs.PathOrFileDescriptor} outputPath
 * @param {any} system_prompt
 * @param {undefined} [question]
 */
async function saveToJSONL(dataset, outputPath, system_prompt, question) {
  const formattedData = dataset.map((item, index) => {
    const text = item.text ? String(item.text) : "";
    const true_value = item.true_value ? "Yes" : "No";

    // Debugging: Log if true_value is not a string
    if (typeof true_value !== "string") {
      console.error(
        `Item at index ${index} has non-string true_value:`,
        true_value
      );
    }

    const concat_sys = system_prompt + "\nThe question is:" + question;

    return {
      messages: [
        {
          role: "system",
          content: concat_sys,
        },
        {
          role: "user",
          content: `Article text: ${text}\n`,
        },
        { role: "assistant", content: true_value },
      ],
    };
    // }
  });

  // Write to a JSONL file
  const jsonlData = formattedData
    .map((entry) => JSON.stringify(entry))
    .join("\n");

  try {
    fs.writeFileSync(outputPath, jsonlData, "utf-8");
    console.log(`File saved successfully at ${outputPath}`);
  } catch (error) {
    console.error(`Error saving JSONL file at ${outputPath}:`, error);
  }
}

/**
 * @param {string} fineTuneJobId
 * @param {any} writer_id
 */
async function pollFineTuningJobStatus(fineTuneJobId, writer_id) {
  const pollInterval = 60000; // 60 seconds
  const maxRetries = 60; // Maximum number of retries (1 hour)

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const jobStatusResponse = await openai.fineTuning.jobs.retrieve(
        fineTuneJobId
      );
      const jobStatus = jobStatusResponse.status;

      console.log(
        `Polling attempt ${
          attempt + 1
        } for writer ${writer_id}: Job status is '${jobStatus}'`
      );

      latestProgress.set("fine tuning job " + jobStatus);
      console.log(`Latest progress set to${get(latestProgress)}`);

      if (jobStatus === "succeeded") {
        console.log("Fine-tuning completed successfully.");
        const fineTunedModel = jobStatusResponse.fine_tuned_model; // The name of the fine-tuned model
        return fineTunedModel;
      } else if (jobStatus === "failed") {
        console.error("Fine-tuning failed:", jobStatusResponse);

        // Retrieve and log the events
        const eventsResponse = await openai.fineTuning.jobs.listEvents(
          fineTuneJobId
        );
        const events = eventsResponse.data;
        console.error("Fine-tuning job events:");
        events.forEach((event) => {
          console.error(
            `[${event.created_at}] ${event.level}: ${event.message}`
          );
        });

        return null;
      } else {
        // You might also want to log partial progress or any warnings
        const events = await openai.fineTuning.jobs.listEvents(fineTuneJobId);
        console.log("Fine-tuning job events:", events);
      }
    } catch (error) {
      console.error("Error retrieving fine-tuning job status:", error);
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  console.error("Fine-tuning polling timed out.");
  return null;
}

/**
 * Retrieve the fine-tuned model name for a given writer_id
 * @param {number} writer_id - The ID of the writer
 * @returns {Promise<string | null>} The model name or null if not found
 * @param {{ query: (arg0: string, arg1: number[]) => PromiseLike<[any]> | [any]; }} connection
 */
async function getFineTunedModelName(connection, writer_id) {
  const [rows] = await connection.query(
    `SELECT model_name FROM FineTunedModels WHERE writer_id = ? ORDER BY created_at DESC LIMIT 1`,
    [writer_id]
  );

  if (rows.length > 0) {
    return rows[0].model_name;
  } else {
    console.warn(`No fine-tuned model found for writer_id: ${writer_id}`);
    return null;
  }
}

// Main function
// @ts-ignore
export async function POST({ request }) {
  const {
    trainingSet,
    // validationSet,
    testSet,
    question,
    system_prompt,
    $prompts,
    prompt_type,
    writer_id,
  } = await request.json();
  let connection;
  console.log("QUESSSSS reveived in server:" + question);
  console.log("IN SERVER RECEIVED:" + prompt_type + writer_id);

  try {
    // Begin a transaction to ensure all inserts are either fully completed or rolled back in case of an error
    connection = await db.getConnection();

    await connection.beginTransaction();

    // const existingModelName = await getFineTunedModelName(
    //   // @ts-ignore
    //   connection,
    //   writer_id
    // );

    latestProgress.set("annotating");

    for (
      let perturbation_index = 0;
      perturbation_index < 5;
      perturbation_index++
    ) {
      console.log(`Running perturbation index ${perturbation_index}`);

      console.log("QUESTION THIS TIME:" + question);
      // Insert into Prompt for each run
      const [promptResult] = await connection.query(
        `INSERT INTO Prompt (text, prompt_type, time_submitted, writer_id, perturbation_index) VALUES (?, ?, NOW(), ?, ?)`,
        [question, prompt_type, writer_id, perturbation_index]
      );
      // @ts-ignore
      const newPromptId = promptResult.insertId;
      console.log("New Prompt ID:", newPromptId);

      // const videoMap = new Map();

      for (const item of testSet) {
        const {
          prompt_type,
          article_url,
          text,
          true_value,
          original_pred,
          original_annotation_id,
        } = item;

        let responseContent;
        let predicted_value;
        let probability;
        let confidence;

        // Construct the base prompt with video and comment information
        const concat_sys =
          system_prompt +
          `\nThe question is: You are an assistant specializing in news article text content analysis and annotation.
    You will be given text in news articles.
    Your task is to determine whether an article contains "hard news."` +
          question;
        // const base_prompt = `Prompt for annotation: ${question}\nArticle text: ${text}\n`;
        const base_prompt = `Article text: ${text}\n`;
        const messages = [
          { role: "system", content: concat_sys },
          { role: "user", content: base_prompt },
        ];

        // Call OpenAI API and retry if needed
        let retries = 3;
        while (retries > 0) {
          try {
            // @ts-ignore
            const gptResponse = await openai.chat.completions.create({
              model: "gpt-4o-mini-2024-07-18",
              // @ts-ignore
              messages: messages,
              temperature: 0.7, //Set temp to 0.7
            });

            // @ts-ignore
            responseContent = gptResponse.choices[0].message.content.trim();
            // predicted_value = parseResponse(responseContent);
            const parsedResult = parseResponse(responseContent);
            predicted_value = parsedResult.prediction;
            probability = parsedResult.probability;
            confidence = parsedResult.confidence;
            retries = 0;

            // Check if choices array is present
            if (
              !gptResponse.choices ||
              !gptResponse.choices[0] ||
              !gptResponse.choices[0].message
            ) {
              console.error(
                "Unexpected OpenAI API response format:",
                gptResponse
              );
              throw new Error(
                "OpenAI API response did not contain expected 'choices' data."
              );
            }
          } catch (error) {
            console.error("Error calling OpenAI API:", error);
            if (--retries === 0) throw error;
            await new Promise((resolve) => setTimeout(resolve, 150000)); // Retry after delay
          }
        }

        const articleKey = `${article_url}_${newPromptId}`;
        let articleId;
        // Insert into Article
        const [articleResult] = await connection.query(
          `INSERT INTO Article (url, text, prompt_id) VALUES (?, ?, ?)`,
          [article_url, text, newPromptId]
        );
        // @ts-ignore
        articleId = articleResult.insertId;

        // 4. Insert into Annotation
        // const booleanPredictedValue = predicted_value === "true" ? 1 : 0;
        // await connection.query(
        //   `INSERT INTO Annotation (true_value, predicted_value, article_id, prompt_id) VALUES (?, ?, ?, ?)`,
        //   [true_value, booleanPredictedValue, articleId, newPromptId]
        // );
        // console.log(
        //   "INSERTED:" + true_value + booleanPredictedValue + predicted_value
        // );

        const booleanPredictedValue = predicted_value === "true" ? 1 : 0;

        await connection.query(
          `INSERT INTO Annotation (true_value, predicted_value, probability, confidence, article_id, prompt_id, perturbation_index) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            true_value,
            booleanPredictedValue,
            probability,
            confidence,
            articleId,
            newPromptId,
            perturbation_index,
          ]
        );
        console.log(
          "INSERTED:true" +
            true_value +
            " pred: " +
            booleanPredictedValue +
            predicted_value +
            " prob: " +
            probability +
            " conf: " +
            confidence +
            " perturb id: " +
            perturbation_index
        );
      }
    }

    // Commit the transaction after successfully inserting all records
    await connection.commit();
    latestProgress.set("annotation completed");
    // @ts-ignore
    // waitingForAnnotation.set(false);
    // pendingPrompt.set(null);
    return new Response(
      JSON.stringify({
        message: "Data processed and saved to database successfully",
        // prompt_id: newPromptId,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing data:", error);

    // Rollback transaction in case of an error to maintain data integrity
    // @ts-ignore
    await connection.rollback();

    return new Response(JSON.stringify({ message: "Failed to process data" }), {
      status: 500,
    });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ progress: get(latestProgress) }), {
    status: 200,
  });
}
