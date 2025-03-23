<script>
  // @ts-nocheck

  import { writable } from "svelte/store";
  import { get } from "svelte/store";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { getContext } from "svelte";
  import seedrandom from "seedrandom";
  // @ts-ignore
  import { csvParse } from "d3-dsv";
  import Fa from "svelte-fa";
  import {
    faBookBookmark,
    faChevronLeft,
    faChevronRight,
    faHouse,
    faToggleOn,
    faToggleOff,
    faChevronDown,
  } from "@fortawesome/free-solid-svg-icons";
  import { tick } from "svelte";

  import {
    selectedAnnotationType,
    userId,
    userName,
    prompts,
  } from "$lib/stores";

  import {
    Chart,
    BarController,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    registerables,
  } from "chart.js";
  // import WordCloud from "wordcloud";

  let wordCloudCanvas;

  let exampleData = [];
  let chartInstance, chartBucket;
  let chartCanvas, chartCanvasBucket;
  Chart.register(...registerables);
  let selectedRun = "Aggregated";
  let summary = writable("Waiting for AI summary...");
  let explanationText = writable([]); // explanations for word analysis
  let wordFrequency = writable([]);
  let uncertaintyData = [];

  let selectedOptions = {
    runs5: false,
    buckets5: false,
    summary: false,
    certaintyAgree: false,
    allPromptsBucket: false,
  };

  // function toggleOption(option) {
  //   selectedOptions[option] = !selectedOptions[option];
  //   console.log("Updated selected options:", selectedOptions);
  // }

  function toggleOption(option) {
    selectedOptions[option] = !selectedOptions[option];
    console.log("Updated selected options:", selectedOptions);

    // Wait for the DOM to update before trying to access canvases
    tick().then(() => {
      if (option === "runs5" && selectedOptions.runs5) {
        renderChart();
      }
      if (option === "buckets5" && selectedOptions.buckets5) {
        renderChartBucket();
      }
      if (option === "summary" && selectedOptions.summary) {
        summarizeExplanations();
      }
      if (option === "certaintyAgree" && selectedOptions.certaintyAgree) {
        updateTable();
      }
      if (option === "allPromptsBucket" && selectedOptions.allPromptsBucket) {
        renderUncertaintyTrendsChart();
      }
    });
  }
  const query = $page.url.searchParams;
  const title = query.get("title");
  const id = query.get("id");
  const idshow = query.get("idshow");
  let textP, timeP;

  function formatTimeSubmitted(time) {
    const date = new Date(time);
    let formattedTime = date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
      hour12: false,
    });
    return formattedTime;
  }

  function getPromptInfo(id) {
    let textP, timeP;
    for (const oneP of $prompts) {
      if (oneP.prompt_id == id) {
        textP = oneP.text;
        timeP = oneP.time_submitted;
      }
    }
    return [textP, timeP];
  }

  onMount(async () => {
    console.log("MOUNTINGGGGGGG");
    console.log("Current prompts:", $prompts);
    [textP, timeP] = getPromptInfo(id);
    console.log(textP);

    if (!id) {
      console.error("Prompt ID is missing");
      return;
    }

    try {
      const response = await fetch(
        `/api/getExamples?prompt_id=${id}&writer_id=${$userId}`
      );
      if (response.ok) {
        exampleData = await response.json();
        console.log(
          "Debug: exampleData JUST GOT in stats:",
          exampleData.slice(0, 5)
        );
        // renderChart();
      } else {
        console.error("Failed to fetch examples");
      }
    } catch (error) {
      console.error("Error fetching examples:", error);
    }

    // if (typeof window !== "undefined") {
    //   const WordCloud = (await import("wordcloud")).default;

    const explanations = exampleData
      .map((ex) => ex.explanation)
      .filter((ex) => ex !== null && ex !== undefined && ex.trim() !== ""); // Remove empty values
    explanationText.set(explanations);
    computeWordFrequency(explanations);

    //   renderWordCloud();
    // }

    // Getting all the prompt data for the 5th chart
    console.log("Fetching uncertainty data for all prompts...");

    const userIdValue = get(userId);
    const allPrompts = get(prompts);

    if (!userIdValue || !allPrompts.length) {
      console.error("User ID or prompts data missing.");
      return;
    }

    let promptUncertainty = {}; // Stores bucket counts per prompt

    for (const prompt of allPrompts) {
      try {
        // Fetch all perturbations of this prompt
        const response = await fetch(
          `/api/getExamples?prompt_id=${prompt.prompt_id}&writer_id=${userIdValue}`
        );
        if (response.ok) {
          const perturbations = await response.json();
          console.log(
            `Fetched ${perturbations.length} perturbations for prompt ${prompt.prompt_id}`
          );

          // Initialize buckets
          let buckets = {
            "Very Likely": 0,
            "Somewhat Likely": 0,
            "Even Chance": 0,
            "Somewhat Unlikely": 0,
            "Very Unlikely": 0,
          };

          let totalAnnotations = 0;

          // Aggregate all perturbation data
          perturbations.forEach((row) => {
            let bucket;
            if (row.probability >= 0.8) bucket = "Very Likely";
            else if (row.probability >= 0.6) bucket = "Somewhat Likely";
            else if (row.probability >= 0.4) bucket = "Even Chance";
            else if (row.probability >= 0.2) bucket = "Somewhat Unlikely";
            else bucket = "Very Unlikely";

            buckets[bucket]++;
            totalAnnotations++;
          });

          // Normalize bucket proportions
          Object.keys(buckets).forEach((bucket) => {
            if (totalAnnotations > 0) {
              buckets[bucket] = (buckets[bucket] / totalAnnotations) * 100;
            }
          });

          promptUncertainty[prompt.prompt_id] = buckets;
        } else {
          console.error(
            `Failed to fetch perturbations for prompt ${prompt.prompt_id}`
          );
        }
      } catch (error) {
        console.error("Error fetching perturbations:", error);
      }
    }

    uncertaintyData = Object.entries(promptUncertainty).map(
      ([promptId, bucketData]) => ({
        promptId,
        ...bucketData,
      })
    );

    console.log("Final Uncertainty Data:", uncertaintyData.slice(0, 5)); // Debugging print
    renderUncertaintyTrendsChart();
  });

  let uncertaintyTrendsCanvas, uncertaintyTrendsChart;

  function renderUncertaintyTrendsChart() {
    if (!uncertaintyData.length) return;

    const labels = uncertaintyData.map((d) => `Prompt ${d.promptId}`);
    const datasets = [
      {
        label: "Very Likely (≥ 0.8)",
        data: uncertaintyData.map((d) => d["Very Likely"]),
        borderColor: "rgba(102, 187, 106, 1)", // Green
        backgroundColor: "rgba(102, 187, 106, 0.2)",
        borderWidth: 2,
        tension: 0.3,
      },
      {
        label: "Somewhat Likely (0.6 - 0.8)",
        data: uncertaintyData.map((d) => d["Somewhat Likely"]),
        borderColor: "rgba(54, 162, 235, 1)", // Blue
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderWidth: 2,
        tension: 0.3,
      },
      {
        label: "Even Chance (0.4 - 0.6)",
        data: uncertaintyData.map((d) => d["Even Chance"]),
        borderColor: "rgba(255, 159, 64, 1)", // Orange
        backgroundColor: "rgba(255, 159, 64, 0.2)",
        borderWidth: 2,
        tension: 0.3,
      },
      {
        label: "Somewhat Unlikely (0.2 - 0.4)",
        data: uncertaintyData.map((d) => d["Somewhat Unlikely"]),
        borderColor: "rgba(153, 102, 255, 1)", // Purple
        backgroundColor: "rgba(153, 102, 255, 0.2)",
        borderWidth: 2,
        tension: 0.3,
      },
      {
        label: "Very Unlikely (< 0.2)",
        data: uncertaintyData.map((d) => d["Very Unlikely"]),
        borderColor: "rgba(239, 83, 80, 1)", // Red
        backgroundColor: "rgba(239, 83, 80, 0.2)",
        borderWidth: 2,
        tension: 0.3,
      },
    ];

    if (uncertaintyTrendsChart) {
      uncertaintyTrendsChart.destroy();
    }

    uncertaintyTrendsChart = new Chart(
      uncertaintyTrendsCanvas.getContext("2d"),
      {
        type: "line",
        data: {
          labels,
          datasets,
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: "Uncertainty Buckets Across All Prompts",
            },
            legend: { position: "top" },
          },
          scales: {
            x: { title: { display: true, text: "Prompts" } },
            y: {
              title: {
                display: true,
                text: "Percentage of Annotations in Bucket",
              },
              beginAtZero: true,
              max: 100,
            },
          },
        },
      }
    );
  }

  // Summary related
  async function summarizeExplanations() {
    await tick();

    if (exampleData.length === 0) {
      summary.set("No data available for summarization.");
      return;
    }
    console.log("Debug: exampleData before sending:", exampleData.slice(0, 5));

    if (get(summary) !== "Waiting for AI summary...") {
      console.log("Summary already generated. Skipping summarization.");
      return;
    }

    try {
      const response = await fetch("/api/getSummary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examples: exampleData }),
      });

      if (response.ok) {
        const { summary: generatedSummary } = await response.json();
        summary.set(generatedSummary);
      } else {
        summary.set("Failed to summarize explanations.");
      }
    } catch (error) {
      summary.set("Error fetching summary.");
      console.error("Error:", error);
    }
  }

  const STOPWORDS = new Set([
    "the",
    "and",
    "which",
    "that",
    "this",
    "with",
    "from",
    "for",
    "was",
    "are",
    "but",
    "not",
    "you",
    "your",
    "have",
    "has",
    "had",
    "they",
    "their",
    "there",
    "can",
    "will",
    "would",
    "should",
    "could",
    "about",
    "after",
    "before",
    "because",
    "so",
    "while",
    "what",
    "when",
    "where",
    "who",
    "how",
    "why",
    "some",
    "more",
    "most",
    "any",
    "all",
    "just",
    "been",
    "being",
    "into",
    "between",
    "upon",
    "out",
    "very",
    "also",
    "own",
    "those",
    "these",
    "other",
    "such",
    "only",
    "even",
  ]);

  function computeWordFrequency(explanations) {
    const wordCount = {};

    explanations.forEach((text) => {
      const words = text
        .toLowerCase()
        .replace(/[^a-zA-Z\s]/g, "") // Remove punctuation
        .split(/\s+/) // Split by whitespace
        .filter((word) => word.length > 2 && !STOPWORDS.has(word)); // Remove stopwords

      words.forEach((word) => {
        wordCount[word] = (wordCount[word] || 0) + 1;
      });
    });

    // Sort words by frequency (descending)
    const sortedWords = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15); // Show top 15 words

    console.log("Top word frequencies (without stopwords):", sortedWords);
    wordFrequency.set(sortedWords);
  }

  function renderWordCloud() {
    if (!$wordFrequency.length) return;

    const words = $wordFrequency.map(([word, count]) => [word, count * 10]); // Scale frequency

    WordCloud(wordCloudCanvas, {
      list: words,
      gridSize: 10,
      weightFactor: 3,
      fontFamily: "Poppins",
      color: "random-dark",
      backgroundColor: "#fff",
      rotateRatio: 0.5,
      minSize: 10,
    });

    console.log("Word Cloud Rendered");
  }

  async function renderChartBucket() {
    await tick();
    if (!exampleData.length) return;

    let uncertaintyBuckets = {
      "Very Likely": { yes: 0, no: 0 },
      "Somewhat Likely": { yes: 0, no: 0 },
      "Even Chance": { yes: 0, no: 0 },
      "Somewhat Unlikely": { yes: 0, no: 0 },
      "Very Unlikely": { yes: 0, no: 0 },
    };

    if (selectedRun === "Aggregated") {
      // Aggregate across all runs (average uncertainty)
      let runCounts = new Array(5).fill(0); // Track number of samples per run

      exampleData.forEach((row) => {
        if (row.probability !== undefined) {
          runCounts[row.perturbation_index - 1]++;

          if (row.probability >= 0.8) {
            row.predicted_value === 1
              ? uncertaintyBuckets["Very Likely"].yes++
              : uncertaintyBuckets["Very Likely"].no++;
          } else if (row.probability >= 0.6) {
            row.predicted_value === 1
              ? uncertaintyBuckets["Somewhat Likely"].yes++
              : uncertaintyBuckets["Somewhat Likely"].no++;
          } else if (row.probability >= 0.4) {
            row.predicted_value === 1
              ? uncertaintyBuckets["Even Chance"].yes++
              : uncertaintyBuckets["Even Chance"].no++;
          } else if (row.probability >= 0.2) {
            row.predicted_value === 1
              ? uncertaintyBuckets["Somewhat Unlikely"].yes++
              : uncertaintyBuckets["Somewhat Unlikely"].no++;
          } else {
            row.predicted_value === 1
              ? uncertaintyBuckets["Very Unlikely"].yes++
              : uncertaintyBuckets["Very Unlikely"].no++;
          }
        }
      });

      // Normalize by the number of runs
      Object.keys(uncertaintyBuckets).forEach((key) => {
        uncertaintyBuckets[key].yes /= 5;
        uncertaintyBuckets[key].no /= 5;
      });
    } else {
      // Filter by selected model run
      exampleData.forEach((row) => {
        if (row.perturbation_index === parseInt(selectedRun)) {
          if (row.probability >= 0.8) {
            row.predicted_value === 1
              ? uncertaintyBuckets["Very Likely"].yes++
              : uncertaintyBuckets["Very Likely"].no++;
          } else if (row.probability >= 0.6) {
            row.predicted_value === 1
              ? uncertaintyBuckets["Somewhat Likely"].yes++
              : uncertaintyBuckets["Somewhat Likely"].no++;
          } else if (row.probability >= 0.4) {
            row.predicted_value === 1
              ? uncertaintyBuckets["Even Chance"].yes++
              : uncertaintyBuckets["Even Chance"].no++;
          } else if (row.probability >= 0.2) {
            row.predicted_value === 1
              ? uncertaintyBuckets["Somewhat Unlikely"].yes++
              : uncertaintyBuckets["Somewhat Unlikely"].no++;
          } else {
            row.predicted_value === 1
              ? uncertaintyBuckets["Very Unlikely"].yes++
              : uncertaintyBuckets["Very Unlikely"].no++;
          }
        }
      });
    }

    const labels = Object.keys(uncertaintyBuckets);
    const yesData = labels.map((label) => uncertaintyBuckets[label].yes);
    const noData = labels.map((label) => uncertaintyBuckets[label].no);

    if (chartBucket) {
      chartBucket.destroy();
    }

    chartBucket = new Chart(chartCanvasBucket.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Yes Labels",
            data: yesData,
            backgroundColor: "rgba(102, 187, 106, 0.5)", // Green
            borderColor: "rgba(102, 187, 106, 1)",
            borderWidth: 2,
          },
          {
            label: "No Labels",
            data: noData,
            backgroundColor: "rgba(239, 83, 80, 0.5)", // Red
            borderColor: "rgba(239, 83, 80, 1)",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Label Counts Grouped by Uncertainty (${selectedRun})`,
          },
          legend: { position: "top" },
        },
        scales: {
          x: { title: { display: true, text: "Uncertainty Levels" } },
          y: {
            title: { display: true, text: "Label Count" },
            beginAtZero: true,
          },
        },
      },
    });
  }

  function renderChart() {
    console.log("RENDERING");
    if (!exampleData.length) return;

    // Group data by perturbation_index (model run) and count Yes/No labels
    const modelRuns = [1, 2, 3, 4, 5];
    let yesCounts = new Array(5).fill(0);
    let noCounts = new Array(5).fill(0);

    exampleData.forEach((row) => {
      const runIndex = row.perturbation_index; // Convert run to 0-based index
      if (row.predicted_value === 1) {
        yesCounts[runIndex]++;
      } else {
        noCounts[runIndex]++;
      }
    });

    const ctx = chartCanvas.getContext("2d");

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: modelRuns.map((run) => `Run ${run}`),
        datasets: [
          {
            label: "Yes Labels",
            data: yesCounts,
            backgroundColor: "rgba(102, 187, 106, 0.5)",
            borderColor: "rgba(102, 187, 106, 1)",
            borderWidth: 2,
          },
          {
            label: "No Labels",
            data: noCounts,
            backgroundColor: "rgba(239, 83, 80, 0.5)",
            borderColor: "rgba(239, 83, 80, 1)",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: "Label Changes Across 5 Model Runs" },
          datalabels: {
            anchor: "end",
            align: "top",
            formatter: (value) => value, // Show raw number of instances
            color: "#000",
            font: { weight: "bold", size: 14 },
          },
        },
        scales: {
          x: { title: { display: true, text: "Model Runs" } },
          y: {
            title: { display: true, text: "Label Count" },
            beginAtZero: true,
          },
        },
      },
    });

    renderChartBucket();
  }

  // scripts for option 4 table
  let selectedBucket = "Very Likely";
  let filteredAnnotations = [];
  const bucketRanges = {
    "Very Likely": [0.8, 1.0],
    "Somewhat Likely": [0.6, 0.8],
    "Even Chance": [0.4, 0.6],
    "Somewhat Unlikely": [0.2, 0.4],
    "Very Unlikely": [0.0, 0.2],
  };

  function updateTable() {
    if (!exampleData.length) return;

    // Extract probability range for selected bucket
    const [minProb, maxProb] = bucketRanges[selectedBucket] || [0, 1];

    // Filter instances belonging to this bucket and group by instance
    let groupedAnnotations = {};
    exampleData.forEach((row) => {
      if (row.probability >= minProb && row.probability < maxProb) {
        if (!groupedAnnotations[row.article_url]) {
          groupedAnnotations[row.article_url] = {
            predictions: new Array(5).fill(null),
          };
        }
        groupedAnnotations[row.article_url].predictions[
          row.perturbation_index
        ] = row.predicted_value;
      }
    });

    // Convert to array for rendering
    filteredAnnotations = Object.values(groupedAnnotations);
  }
</script>

<section class="head">
  <nav>
    <!-- Logo -->
    <div class="nav-left">
      <a href={`../prompts`} style="vertical-align:top; margin:5px 10px 0 0;"
        ><Fa icon={faChevronLeft} /></a
      >
      <img src="/imgs/logo.png" alt="AnnotateThis" class="logo" />
      <h1 style="vertical-align:top; white-space: nowrap; margin:5px 0 0 12px;">
        Statistics
      </h1>
    </div>

    <!-- User -->
    <div class="nav-right">
      <h1 style="margin:0% 15% 0% 0%;">{get(userName)}</h1>
      <img src="/imgs/user-icon.png" alt="User Icon" class="user-icon" />
    </div>
  </nav>
</section>

<section>
  <div class="top">
    <h2>This page is under construction</h2>
    <p>
      <span style="font-weight:bold">Prompt {idshow} </span>
      ({formatTimeSubmitted(timeP)})
    </p>
    <p>{textP}</p>
  </div>
</section>

<section class="chart-button-group">
  <div class="checkbox-group">
    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("runs5")}
        bind:checked={selectedOptions.runs5}
      />
      Show me how the labels changed across different model runs.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("buckets5")}
        bind:checked={selectedOptions.buckets5}
      />
      Show me the uncertainty for all labels.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("summary")}
        bind:checked={selectedOptions.summary}
      />
      Show me a summary of the explanations.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("certaintyAgree")}
        bind:checked={selectedOptions.certaintyAgree}
      />
      Show me the relationship between the AI's self-reported certainty and how labels
      changed over 5 runs.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("allPromptsBucket")}
        bind:checked={selectedOptions.allPromptsBucket}
      />
      Show me the percentages of examples that fall into each bucket across all prompts.
    </label>
  </div>

  <div style="width:100%">
    {#if !selectedOptions.runs5 && !selectedOptions.buckets5 && !selectedOptions.summary && !selectedOptions.certaintyAgree && !selectedOptions.allPromptsBucket}
      <h3 class="chart-container">&larr; click on a button to see summary</h3>
    {/if}
    {#if selectedOptions.runs5}
      <div class="chart-container">
        <h3>Label changes across model runs</h3>
        <canvas bind:this={chartCanvas}></canvas>
      </div>
    {/if}

    {#if selectedOptions.buckets5}
      <div class="chart-container">
        <h3>Uncertainty for all labels</h3>
        <select
          bind:value={selectedRun}
          on:change={renderChartBucket}
          style="padding: 5px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px;"
        >
          <option value="Aggregated">Aggregated (Average of 5 Runs)</option>
          <option value="0">Run 1</option>
          <option value="1">Run 2</option>
          <option value="2">Run 3</option>
          <option value="3">Run 4</option>
          <option value="4">Run 5</option>
        </select>
        <canvas bind:this={chartCanvasBucket}></canvas>
      </div>
    {/if}

    <!-- {#if selectedOptions.summary}
      <div class="chart-container">
        <h3>AI Summary</h3>
        <p>{$summary}</p>
      </div>
    {/if} -->
    {#if selectedOptions.summary}
      <div class="chart-container">
        <h3>AI Summary</h3>
        <p>{$summary}</p>
      </div>

      {#if $wordFrequency.length > 0}
        <div class="chart-container">
          <h3>Most Frequent Words in Explanations</h3>
          <table class="styled-table">
            <thead>
              <tr>
                <th>Word</th>
                <th>Frequency</th>
              </tr>
            </thead>
            <tbody>
              {#each $wordFrequency as [word, count]}
                <tr>
                  <td>{word}</td>
                  <td>{count}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <!-- <div class="chart-container">
          <h3>Word Cloud</h3>
          <canvas bind:this={wordCloudCanvas}></canvas>
        </div> -->
      {/if}
    {/if}

    <!-- {#if selectedOptions.certaintyAgree}
      <div class="chart-container">
        <h3>
          The relationship between AI's self-reported certainty & how labels
          change over 5 runs
        </h3>
      </div>
    {/if} -->
    {#if selectedOptions.certaintyAgree}
      <div class="chart-container">
        <h3>
          The relationship between AI's self-reported certainty & how labels
          change over 5 runs
        </h3>

        <!-- Dropdown to Select Uncertainty Bucket -->
        <label for="bucketSelect">Select Uncertainty Bucket:</label>
        <select bind:value={selectedBucket} on:change={updateTable}>
          {#each Object.keys(bucketRanges) as bucket}
            <option value={bucket}>{bucket}</option>
          {/each}
        </select>
      </div>

      <!-- Table for showing annotations over 5 runs -->
      {#if filteredAnnotations.length > 0}
        <div class="chart-container">
          <h3>Annotations in "{selectedBucket}" Across 5 Model Runs</h3>
          <table class="styled-table">
            <thead>
              <tr>
                <th>Instance</th>
                <th>Run 1</th>
                <th>Run 2</th>
                <th>Run 3</th>
                <th>Run 4</th>
                <th>Run 5</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredAnnotations as annotation, index}
                <tr>
                  <td>{index + 1}</td>
                  {#each annotation.predictions as prediction}
                    <td
                      style="color: {prediction === 1 ? '#66bb6a' : '#ef5350'};"
                    >
                      {prediction === 1 ? "Yes" : "No"}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p>No annotations found in this bucket.</p>
      {/if}
    {/if}

    <!-- {#if selectedOptions.allPromptsBucket}
      <div class="chart-container">
        <h3>The percentages of examples in each bucket from all prompts</h3>
      </div>
    {/if} -->
    {#if selectedOptions.allPromptsBucket}
      <div class="chart-container">
        <h3>Uncertainty Trends Across All Prompts</h3>
        <canvas bind:this={uncertaintyTrendsCanvas}></canvas>
      </div>
    {/if}
  </div>
</section>

<style>
  .chart-button-group {
    display: flex;
    flex-direction: row;
    margin: 0 5% 0 5%;
    align-items: flex-start;
    gap: 8px;
  }

  .chart-container {
    width: 90%;
    margin: auto;
  }
  .top {
    margin: 0% 5% 3% 5%;
    display: flex-start;
  }

  .head {
    margin: 1% 5% 1% 5%;
    display: flex-start;
  }

  nav {
    width: 100%;
    padding: 16px 16px 16px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .nav-left,
  .nav-center,
  .nav-right {
    display: flex;
    align-items: center;
  }

  .logo {
    height: 32px;
  }

  .user-icon {
    height: 24px;
    width: 24px;
    border-radius: 50%;
  }

  /* link related css */

  a:link {
    text-decoration: none;
    color: #188df9;
  }

  a:visited {
    text-decoration: none;
    color: #188df9;
  }

  a:hover {
    text-decoration: solid;
    color: #5facf2;
    font-weight: bold;
  }

  a:active {
    text-decoration: none;
    color: #5facf2;
  }

  /* checkbox styling */
  .checkbox-group {
    width: 30%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .checkbox-group-c {
    display: block;
    text-decoration: none;
    font-size: 18px;
    font-weight: bold;
    padding: 15px 30px;
    border-radius: 10px; /* Fully rounded */
    text-align: center;
    transition: all 0.3s ease;
    border: 2px solid #7eb7f5;
    color: #3498db;
    background-color: transparent;
  }

  .checkbox-group-c:hover {
    background-color: #7eb7f5;
    color: white;
  }

  .checkbox-group-c:checked {
    background-color: #7eb7f5;
    color: white;
  }
</style>
