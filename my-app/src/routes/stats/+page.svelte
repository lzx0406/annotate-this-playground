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
    faCircleInfo,
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
    ScatterController,
    BarController,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    registerables,
  } from "chart.js";
  import ChartDataLabels from "chartjs-plugin-datalabels";
  // import WordCloud from "wordcloud";

  let wordCloudCanvas;

  let exampleData = [];
  let chartInstance, chartBucket;
  let chartCanvas, chartCanvasBucket;
  let labelCountChartCanvas, labelCountChart;
  let chartCanvasScatter;
  let chartScatter;
  let chartNumAgree;
  let agreementData = {};
  let chartCanvasIAA;
  Chart.register(...registerables);
  Chart.register(ChartDataLabels);
  let selectedRun = "Aggregated";
  let summary = writable("Waiting for AI summary...");
  let explanationText = writable([]); // explanations for word analysis
  let wordFrequency = writable([]);
  let uncertaintyData = [];
  let clabels = [],
    cyesMeans = [],
    cyesStds = [],
    cnoMeans = [],
    cnoStds = [];

  let selectedOptions = {
    runs5: false,
    buckets5: false,
    summary: false,
    certaintyAgree: false,
    allPromptsBucket: false,
  };

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
        processAgreementData();
        renderScatterPlot();
        updateTable();
        computeIAA();
      }
      if (option === "allPromptsBucket" && selectedOptions.allPromptsBucket) {
        renderUncertaintyTrendsChart();
        renderYesNoChart(clabels, cyesMeans, cyesStds, cnoMeans, cnoStds);
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

    const explanations = exampleData
      .map((ex) => ex.explanation)
      .filter((ex) => ex !== null && ex !== undefined && ex.trim() !== ""); // Remove empty values
    explanationText.set(explanations);
    computeWordFrequency(explanations);

    // Getting all the prompt data for chart 5
    console.log("Fetching uncertainty data for all prompts...");

    const userIdValue = get(userId);
    const allPrompts = get(prompts);

    if (!userIdValue || !allPrompts.length) {
      console.error("User ID or prompts data missing.");
      return;
    }

    let promptUncertainty = {}; // Stores bucket counts per prompt

    let yesMeans = [],
      yesStds = [],
      noMeans = [],
      noStds = [];
    let labels = [];

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

          // For showing Yes/No
          let yesPerRun = [0, 0, 0, 0, 0];
          let noPerRun = [0, 0, 0, 0, 0];

          perturbations.forEach((row) => {
            const idx = row.perturbation_index;
            if (row.predicted_value === 1) yesPerRun[idx]++;
            else noPerRun[idx]++;
          });

          yesMeans.push(mean(yesPerRun));
          yesStds.push(std(yesPerRun));
          noMeans.push(mean(noPerRun));
          noStds.push(std(noPerRun));
          labels.push(`Prompt ${labels.length + 1}`);
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

    // renderYesNoChart(labels, yesMeans, yesStds, noMeans, noStds);
    clabels = labels;
    cyesMeans = yesMeans;
    cyesStds = yesStds;
    cnoMeans = noMeans;
    cnoStds = noStds;
    renderYesNoChart(clabels, cyesMeans, cyesStds, cnoMeans, cnoStds);

    console.log("Final Uncertainty Data:", uncertaintyData.slice(0, 5));
    renderUncertaintyTrendsChart();

    computeIAA();
    processAgreementData();
    renderScatterPlot();

    // if (typeof window !== "undefined") {
    //   const WordCloud = (await import("wordcloud")).default;
    //   renderWordCloud();
    // }
  });

  // Utility functions
  function mean(arr) {
    const total = arr.reduce((acc, val) => acc + val, 0);
    return total / arr.length;
  }

  function std(arr) {
    const m = mean(arr);
    const variance =
      arr.reduce((acc, val) => acc + (val - m) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }

  // chart 5 yes/no
  function renderYesNoChart(labels, yesMeans, yesStds, noMeans, noStds) {
    if (labelCountChart) labelCountChart.destroy();

    labelCountChart = new Chart(labelCountChartCanvas.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Yes Labels",
            data: yesMeans,
            backgroundColor: "rgba(102, 187, 106, 0.5)",
            borderColor: "rgba(102, 187, 106, 1)",
            borderWidth: 1,
            errorBarData: yesStds,
          },
          {
            label: "No Labels",
            data: noMeans,
            backgroundColor: "rgba(239, 83, 80, 0.5)",
            borderColor: "rgba(239, 83, 80, 1)",
            borderWidth: 1,
            errorBarData: noStds,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: "Average Yes/No Counts per Prompt with StdDev",
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const std =
                  context.dataset.label === "Yes Labels"
                    ? yesStds[context.dataIndex]
                    : noStds[context.dataIndex];
                return `${context.dataset.label}: ${context.raw.toFixed(1)} ± ${std.toFixed(1)}`;
              },
            },
          },
          datalabels: {
            anchor: "end",
            align: "top",
            formatter: (value) => value,
            font: { weight: "bold", size: 12 },
          },
        },
        scales: {
          x: { title: { display: true, text: "Prompts" } },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Average Label Count" },
          },
        },
      },
    });
  }

  // Chart 5 uncertainty trends
  let uncertaintyTrendsCanvas, uncertaintyTrendsChart;

  function renderUncertaintyTrendsChart() {
    if (!uncertaintyData.length) return;

    // const labels = uncertaintyData.map((d) => `Prompt ${d.promptId}`);
    const labels = uncertaintyData.map((_, i) => `Prompt ${i + 1}`);

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
            datalabels: {
              display: false,
            },
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

  // option 3 summary related
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

  // Chart 2 buckets
  async function renderChartBucket() {
    await tick();
    if (!exampleData.length) return;

    // let uncertaintyBuckets = {
    //   "Very Likely": { yes: 0, no: 0 },
    //   "Somewhat Likely": { yes: 0, no: 0 },
    //   "Even Chance": { yes: 0, no: 0 },
    //   "Somewhat Unlikely": { yes: 0, no: 0 },
    //   "Very Unlikely": { yes: 0, no: 0 },
    // };
    let uncertaintyBuckets = {
      "Very Unlikely": { yes: 0, no: 0 },
      "Somewhat Unlikely": { yes: 0, no: 0 },
      "Even Chance": { yes: 0, no: 0 },
      "Somewhat Likely": { yes: 0, no: 0 },
      "Very Likely": { yes: 0, no: 0 },
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
          datalabels: {
            anchor: "end",
            align: "top",
            formatter: (value) => value,
            font: { weight: "bold", size: 12 },
          },
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

  // Chart 1 Yes/No labels by perturbation
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
            formatter: (value) => value,
            font: { weight: "bold", size: 12 },
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

    const [minProb, maxProb] = bucketRanges[selectedBucket] || [0, 1];

    let groupedAnnotations = {};

    // All articles that belong to the selected bucket
    let validArticles = new Set();
    exampleData.forEach((row) => {
      if (row.probability >= minProb && row.probability < maxProb) {
        validArticles.add(row.article_url);
      }
    });

    // ALL annotations for these articles
    exampleData.forEach((row) => {
      if (validArticles.has(row.article_url)) {
        if (!groupedAnnotations[row.article_url]) {
          groupedAnnotations[row.article_url] = {
            article_url: row.article_url,
            article_text: row.text,
            predictions: new Array(5).fill(null),
            probabilities: new Array(5).fill(null),
          };
        }
        groupedAnnotations[row.article_url].predictions[
          row.perturbation_index
        ] = row.predicted_value;
        groupedAnnotations[row.article_url].probabilities[
          row.perturbation_index
        ] = row.probability.toFixed(2);
      }
    });

    filteredAnnotations = Object.values(groupedAnnotations);
  }

  // Calculate IAA
  function computeIAA() {
    console.log("Starting IAA computation...");
    if (!exampleData.length) {
      console.error("No example data available!");
      return;
    }

    let groupedData = { overall: [] };

    Object.keys(bucketRanges).forEach((bucket) => {
      groupedData[bucket] = [];
    });

    console.log("Initialized groupedData for IAA:", groupedData);

    let groupedAnnotations = {};

    // Assign articles to buckets
    let validArticles = {};
    exampleData.forEach((row) => {
      for (const bucket in bucketRanges) {
        const [minProb, maxProb] = bucketRanges[bucket];
        if (row.probability >= minProb && row.probability < maxProb) {
          if (!validArticles[bucket]) validArticles[bucket] = new Set();
          validArticles[bucket].add(row.article_url);
        }
      }
    });

    console.log("Valid articles per bucket:", validArticles);

    exampleData.forEach((row) => {
      for (const bucket in validArticles) {
        if (validArticles[bucket].has(row.article_url)) {
          if (!groupedAnnotations[row.article_url]) {
            groupedAnnotations[row.article_url] = {
              predictions: new Array(5).fill(null),
            };
          }
          groupedAnnotations[row.article_url].predictions[
            row.perturbation_index
          ] = row.predicted_value;
        }
      }
    });

    console.log("Grouped Annotations per article:", groupedAnnotations);

    // Convert to structured format per bucket
    Object.keys(validArticles).forEach((bucket) => {
      validArticles[bucket].forEach((article) => {
        groupedData[bucket].push([...groupedAnnotations[article].predictions]);
      });
    });

    groupedData["overall"] = Object.values(groupedAnnotations).map((entry) => [
      ...entry.predictions,
    ]);

    console.log("Final grouped data:", groupedData);

    // Fleiss' Kappa & Percentage Agreement
    let agreementScores = {};
    for (const bucket in groupedData) {
      if (groupedData[bucket].length > 0) {
        console.log(`Computing agreement for bucket: ${bucket}`);
        agreementScores[bucket] = {
          fleiss_kappa: computeFleissKappa(groupedData[bucket]),
          percentage_agreement:
            groupedData[bucket]
              .map((annotations) =>
                annotations.every((val) => val === annotations[0]) ? 1 : 0
              )
              .reduce((sum, x) => sum + x, 0) / groupedData[bucket].length,
        };
      } else {
        console.warn(`No data for bucket: ${bucket}`);
        agreementScores[bucket] = {
          fleiss_kappa: null,
          percentage_agreement: null,
        };
      }
    }

    console.log("Agreement Scores:", agreementScores);
    agreementData = agreementScores;
    renderAgreementChart();
  }

  function computeFleissKappa(data) {
    console.log("Computing Fleiss' Kappa...");

    let numAnnotators = 5;
    let numItems = data.length;

    if (numItems === 0) {
      console.warn("No items available for Fleiss' Kappa calculation.");
      return null;
    }

    // Count how many yes/no
    let categoryCounts = { 0: 0, 1: 0 };

    data.forEach((annotations, index) => {
      let counts = { 0: 0, 1: 0 };

      annotations.forEach((label) => {
        if (label !== null) {
          counts[label]++;
          categoryCounts[label]++;
        }
      });

      console.log(`Row ${index + 1} annotation distribution:`, counts);
    });

    // p_j (Expected probability of each category)
    let totalAnnotations = numAnnotators * numItems;
    let p = {
      0: categoryCounts[0] / totalAnnotations,
      1: categoryCounts[1] / totalAnnotations,
    };

    console.log("Category proportions (p_j):", p);

    // Pbar observed agreement
    let P = data.map((annotations) => {
      let counts = { 0: 0, 1: 0 };

      annotations.forEach((label) => {
        if (label !== null) {
          counts[label]++;
        }
      });

      let agreement =
        (counts[0] * (counts[0] - 1) + counts[1] * (counts[1] - 1)) /
        (numAnnotators * (numAnnotators - 1));

      return agreement || 0; // Prevent Na cases
    });

    let Pbar = P.reduce((sum, p) => sum + p, 0) / numItems;

    console.log("Observed Agreement (Pbar):", Pbar);

    // PbarE expected agreement
    let PbarE = p[0] ** 2 + p[1] ** 2;

    console.log("Expected Agreement (PbarE):", PbarE);

    // Fleiss' Kappa
    if (Math.abs(1 - PbarE) < 1e-10) {
      console.warn(
        "PbarE is 1, indicating perfect agreement or zero variation. Returning Kappa = 1."
      );
      return 1;
    }

    let kappa = (Pbar - PbarE) / (1 - PbarE);
    kappa = Math.max(-1, Math.min(kappa, 1)); // Clamp kappa within valid range

    console.log("Final Fleiss' Kappa:", kappa);
    return kappa;
  }

  function renderAgreementChart() {
    if (!agreementData || Object.keys(agreementData).length === 0) {
      console.error("No agreement data available for chart rendering!");
      return;
    }

    console.log("Rendering IAA Chart...");
    console.log("Agreement Data for Chart:", agreementData);

    const labels = Object.keys(agreementData);
    const kappaValues = labels.map(
      (bucket) => agreementData[bucket].fleiss_kappa || 0
    );
    const percentAgreement = labels.map(
      (bucket) => agreementData[bucket].percentage_agreement || 0
    );

    new Chart(chartCanvasIAA.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Fleiss' Kappa",
            data: kappaValues,
            backgroundColor: "rgba(54, 162, 235, 0.5)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 2,
          },
          {
            label: "Percentage Agreement",
            data: percentAgreement,
            backgroundColor: "rgba(255, 99, 132, 0.5)",
            borderColor: "rgba(255, 99, 132, 1)",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: "Inter-Annotator Agreement Across Uncertainty Buckets",
          },
          legend: { position: "top" },
          datalabels: {
            anchor: "end",
            align: "top",
            formatter: (value) => value.toFixed(2),
            font: { weight: "bold", size: 12 },
          },
        },
        scales: {
          x: { title: { display: true, text: "Uncertainty Buckets" } },
          y: {
            title: { display: true, text: "Agreement Score" },
            beginAtZero: true,
          },
        },
      },
    });
  }

  let agreementDataS = [];

  function processAgreementData() {
    if (!exampleData.length) return;

    let groupedData = {};

    // Group by article and count
    exampleData.forEach((row) => {
      let article = row.article_url;

      if (!groupedData[article]) {
        groupedData[article] = { yesVotes: 0, noVotes: 0, probabilities: [] };
      }

      if (row.predicted_value === 1) {
        groupedData[article].yesVotes++;
      } else {
        groupedData[article].noVotes++;
      }

      groupedData[article].probabilities.push(row.probability);
    });

    // Agreement level & average probability
    agreementDataS = Object.values(groupedData).map((group) => {
      let totalVotes = group.yesVotes + group.noVotes;

      let agreementLevel = Math.max(group.yesVotes, group.noVotes);
      let agreementFraction = `${agreementLevel}/5`;

      let avgProbability =
        group.probabilities.reduce((sum, p) => sum + p, 0) / totalVotes;

      return {
        x: agreementFraction,
        y: avgProbability,
      };
    });

    console.log("Processed Scatter Plot Data:", agreementDataS);
  }

  function renderScatterPlot() {
    if (!agreementDataS.length) return;

    const ctx = chartCanvasScatter.getContext("2d");

    if (chartScatter) {
      chartScatter.destroy();
    }

    chartScatter = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Agreement vs. Certainty",
            data: agreementDataS,
            backgroundColor: "rgba(54, 162, 235, 0.4)", // Blue dots
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
            pointRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: "Agreement vs. Certainty Scatter Plot",
          },
          tooltip: {
            callbacks: {
              label: (tooltipItem) => {
                let value = tooltipItem.raw.y.toFixed(2);
                return `Avg Certainty: ${value}`;
              },
            },
          },
          datalabels: {
            display: false,
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Agreement Level (3/5 → 5/5)" },
            type: "category",
            labels: ["3/5", "4/5", "5/5"],
            ticks: {
              autoSkip: false,
            },
          },
          y: {
            title: { display: true, text: "Certainty (0-1)" },
            ticks: {
              // callback: (value) =>
              //   value < 0.3
              //     ? "Not Certain"
              //     : value < 0.7
              //       ? "Somewhat Certain"
              //       : "Certain",
              callback: (value) => value,
            },
          },
        },
      },
    });
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
    <!-- <h2>This page is under construction</h2> -->
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
        on:change={() => toggleOption("allPromptsBucket")}
        bind:checked={selectedOptions.allPromptsBucket}
      />
      Across all prompts: percentages of examples in each bucket & label changes.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("runs5")}
        bind:checked={selectedOptions.runs5}
      />
      Prompt {idshow}: how the labels changed across different model runs.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("buckets5")}
        bind:checked={selectedOptions.buckets5}
      />
      Prompt {idshow}: the uncertainty for all labels.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("summary")}
        bind:checked={selectedOptions.summary}
      />
      Prompt {idshow}: summary of the explanations.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("certaintyAgree")}
        bind:checked={selectedOptions.certaintyAgree}
      />
      Prompt {idshow}: the relationship between the AI's self-reported certainty
      and how labels changed over 5 runs.
    </label>
  </div>

  <div style="width:100%">
    {#if !selectedOptions.runs5 && !selectedOptions.buckets5 && !selectedOptions.summary && !selectedOptions.certaintyAgree && !selectedOptions.allPromptsBucket}
      <h3 class="chart-container">&larr; click on a button to see summary</h3>
    {/if}
    {#if selectedOptions.allPromptsBucket}
      <div class="chart-container">
        <h3>
          Uncertainty Trends Across All Prompts <span
            class="tooltip-container"
            data-tooltip="On this graph are the percentages of annotations that fall into each certainty bucket across all of your past prompts."
          >
            <Fa icon={faCircleInfo} style="opacity: 0.5;" />
          </span>
        </h3>
        <canvas bind:this={uncertaintyTrendsCanvas}></canvas>
      </div>

      <div class="chart-container">
        <h3>Label changes across all prompts</h3>
        <canvas bind:this={labelCountChartCanvas}></canvas>
      </div>
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

    {#if selectedOptions.summary}
      <div class="chart-container">
        <h3>
          AI Summary <span
            class="tooltip-container"
            data-tooltip="We sent all the explanations of results generated by AI to another AI to summarize them. The summary takes a few seconds to generate."
          >
            <Fa icon={faCircleInfo} style="opacity: 0.5;" />
          </span>
        </h3>
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
      {/if}
    {/if}

    <!-- Chart 4 group -->
    {#if selectedOptions.certaintyAgree}
      <div class="chart-container">
        <h3>
          Agreement vs. Certainty <span
            class="tooltip-container"
            data-tooltip="We are mapping the agreement level from 5 model runs on the x-axis, 
            and the average numerical estimate of certainty of these five runs on the y-axis. 
            Each dot represents the average 5-runs certainty on one article."
          >
            <Fa icon={faCircleInfo} style="opacity: 0.5;" />
          </span>
        </h3>
        <canvas bind:this={chartCanvasScatter}></canvas>
      </div>
      <div class="chart-container">
        <h3>
          The relationship between AI's self-reported certainty & how labels
          change over 5 runs
        </h3>

        <label for="bucketSelect">Select Certainty Bucket:</label>
        <select bind:value={selectedBucket} on:change={updateTable}>
          {#each Object.keys(bucketRanges) as bucket}
            <option value={bucket}>{bucket}</option>
          {/each}
        </select>
      </div>

      {#if filteredAnnotations.length > 0}
        <div class="chart-container">
          <h3>
            Annotations in "{selectedBucket}" Across 5 Model Runs
            <span
              class="tooltip-container"
              data-tooltip="Here we show the actual label and numerical estimate of certainty from each run on each article.
            The rows shown here are filtered by selected certainty bucket, if one of the runs have certainty level that fall into the selected bucket,
            the article is shown here."
            >
              <Fa icon={faCircleInfo} style="opacity: 0.5;" />
            </span>
          </h3>
          <p>
            Note: For more details, numbers below each prediction are
            probabilities, scaled by: <br /> "Very Likely": 0.8 ≤ P ≤ 1.0
            <br />
            "Somewhat Likely": 0.6 &le; P &lt; 0.8 <br /> "Even Chance": 0.4
            &le; P &lt; 0.6 <br /> "Somewhat Unlikely": 0.2 &le; P &lt; 0.4
            <br />"Very Unlikely": 0.0 &le; P &lt; 0.2
          </p>
          <table class="styled-table">
            <thead>
              <tr>
                <th>Instance</th>
                <th>Article URL</th>
                <th>Article Text</th>
                {#each [1, 2, 3, 4, 5] as run}
                  <th>Run {run}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each filteredAnnotations as annotation, index}
                <tr>
                  <td>{index + 1}</td>
                  <td>
                    <a
                      href={annotation.article_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {annotation.article_url.slice(28, 42)}...
                    </a>
                  </td>
                  <td>
                    {annotation.article_text.slice(0, 50)}...
                  </td>
                  {#each annotation.predictions as prediction, runIndex}
                    <td
                      style="color: {prediction === 1 ? '#66bb6a' : '#ef5350'};"
                      title="Probability: {annotation.probabilities[runIndex]}"
                    >
                      {prediction === 1 ? "Yes" : prediction === 0 ? "No" : "—"}
                      <br />
                      <small style="color: black; font-size: 12px;">
                        {annotation.probabilities[runIndex] ?? ""}
                      </small>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="chart-container">No annotations found in this bucket.</p>
      {/if}

      <div class="chart-container">
        <h3>
          Inter-Annotator Agreement Across Uncertainty Buckets <span
            class="tooltip-container"
            data-tooltip="Here we show the inter-annotator agreements amongst the 5 model runs. Fleiss' Kappa 
          calculates the degree of agreement in classification over that which would be expected by chance. 
          Percent agreement is calculated for reference. In percent agreement, 5/5 is counted as agree, others are counted as not agree. 
          Note that some buckets may have very few data points, yielding less reliable results."
          >
            <Fa icon={faCircleInfo} style="opacity: 0.5;" />
          </span>
        </h3>
        <canvas bind:this={chartCanvasIAA}></canvas>
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

  .checkbox-group-c:hover,
  .checkbox-group-c:has(input:checked) {
    background-color: #7eb7f5;
    color: white;
  }

  .checkbox-group-c:checked {
    background-color: #7eb7f5;
    color: white;
  }

  /* Hover show info */
  .tooltip-container {
    position: relative;
    display: inline-block;
    cursor: pointer;
  }

  .tooltip-container:hover::after {
    visibility: visible;
    opacity: 1;
  }

  .tooltip-container::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-30%);
    background-color: rgb(245, 245, 245, 0.95);
    border: 2px solid #b2b2b2;
    color: black;
    padding: 10px;
    font-size: 13px;
    font-weight: 400;
    border-radius: 6px;
    width: 500px;
    text-align: left;
    white-space: normal; /* text wrapping */
    line-height: 1.4;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
    z-index: 10;
  }
</style>
