import { db } from "$lib/database.js";

// @ts-ignore
export async function GET({ url }) {
  const userId = url.searchParams.get("userId");

  if (!userId) {
    console.error("User ID is missing in request");
    return new Response(JSON.stringify({ error: "User ID is required" }), {
      status: 400,
    });
  }

  try {
    // Query to get prompts for the given user ID
    const [prompts] = await db.query(
      "SELECT prompt_id, text, prompt_type, time_submitted, metrics FROM Prompt WHERE writer_id = ?",
      [userId]
    );

    console.log("Fetched prompts:", prompts);

    // Process each prompt
    // @ts-ignore
    for (const prompt of prompts) {
      console.log("Processing prompt with ID:", prompt.prompt_id);

      if (!prompt.metrics) {
        console.log("Metrics are null for prompt ID:", prompt.prompt_id);

        // Fetch related annotations for the prompt
        const [annotations] = await db.query(
          "SELECT true_value, predicted_value FROM Annotation WHERE prompt_id = ?",
          [prompt.prompt_id]
        );

        // console.log("Fetched annotations:", annotations);

        // @ts-ignore
        if (annotations.length > 0) {
          const metrics = calculateMetrics(annotations);
          prompt.metrics = metrics;

          // Update the Prompt table with the calculated metrics
          await db.query("UPDATE Prompt SET metrics = ? WHERE prompt_id = ?", [
            JSON.stringify(metrics),
            prompt.prompt_id,
          ]);

          console.log(
            "Updated metrics in database for prompt ID:",
            prompt.prompt_id
          );
        }
      } else {
        console.log("Metrics already exist for prompt ID:", prompt.prompt_id);

        // Parse existing metrics if they are stored as JSON
        try {
          prompt.metrics = JSON.parse(prompt.metrics);
          console.log("Parsed existing metrics:", prompt.metrics);
        } catch (error) {
          // console.error("Error parsing metrics JSON:", error);
          console.error("Error parsing metrics JSON:");
        }
      }
      const [annotations] = await db.query(
        "SELECT predicted_value FROM Annotation WHERE prompt_id = ?",
        [prompt.prompt_id]
      );

      const { yesCount, noCount, yesPercentage, noPercentage } =
        calculateYesNoCounts(annotations);

      // Attach yes/no counts to the prompt response (without modifying the database)
      prompt.yesCount = yesCount;
      prompt.noCount = noCount;
      prompt.yesPercentage = yesPercentage;
      prompt.noPercentage = noPercentage;
    }

    return new Response(JSON.stringify(prompts), { status: 200 });
  } catch (error) {
    console.error("Error fetching prompts:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch prompts" }), {
      status: 500,
    });
  }
}

// Helper function to calculate metrics
/**
 * @param {string | any[] | import("mysql2").OkPacket | import("mysql2").ResultSetHeader} annotations
 */
function calculateMetrics(annotations) {
  // console.log("Calculating metrics for annotations:", annotations);

  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;

  // @ts-ignore
  for (const { true_value, predicted_value } of annotations) {
    if (true_value === 1 && predicted_value === 1) {
      truePositives++;
    } else if (true_value === 0 && predicted_value === 1) {
      falsePositives++;
    } else if (true_value === 0 && predicted_value === 0) {
      trueNegatives++;
    } else if (true_value === 1 && predicted_value === 0) {
      falseNegatives++;
    }
  }

  console.log("True Positives:", truePositives);
  console.log("False Positives:", falsePositives);
  console.log("True Negatives:", trueNegatives);
  console.log("False Negatives:", falseNegatives);

  // @ts-ignore
  const accuracy = (truePositives + trueNegatives) / annotations.length;
  const precision = truePositives / (truePositives + falsePositives || 1);
  const recall = truePositives / (truePositives + falseNegatives || 1);

  // Round precision and recall to 2 decimal places
  const roundedMetrics = {
    accuracy: Number(accuracy.toFixed(2)),
    precision: Number(precision.toFixed(2)),
    recall: Number(recall.toFixed(2)),
  };

  console.log("Calculated Metrics:", roundedMetrics);

  return roundedMetrics;
}

/**
 * @param {import("mysql2").QueryResult} annotations
 */
function calculateYesNoCounts(annotations) {
  let yesCount = 0;
  let noCount = 0;

  for (const { predicted_value } of annotations) {
    if (predicted_value === 1) {
      yesCount++;
    } else if (predicted_value === 0) {
      noCount++;
    }
  }

  const total = yesCount + noCount;
  const yesPercentage = total ? ((yesCount / total) * 100).toFixed(2) : "0.00";
  const noPercentage = total ? ((noCount / total) * 100).toFixed(2) : "0.00";

  return { yesCount, noCount, yesPercentage, noPercentage };
}

// @ts-ignore
// export async function GET({ url }) {
//   const userId = url.searchParams.get("userId");

//   if (!userId) {
//     return new Response(JSON.stringify({ message: "User ID is required" }), {
//       status: 400,
//     });
//   }

//   try {
//     // Query to get prompts for the given user ID
//     const [rows] = await db.query(
//       "SELECT prompt_id, text, prompt_type, time_submitted, metrics FROM Prompt WHERE writer_id = ?",
//       [userId]
//     );

//     // console.log("GET request for prompts went thruUUUUUUUU");

//     return new Response(JSON.stringify(rows), { status: 200 });
//   } catch (error) {
//     console.error("Error fetching prompts:", error);
//     return new Response(
//       JSON.stringify({ message: "Failed to retrieve prompts" }),
//       { status: 500 }
//     );
//   }
// }
