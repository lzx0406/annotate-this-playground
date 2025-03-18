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

  let exampleData = [];
  let chartInstance, chartBucket;
  let chartCanvas, chartCanvasBucket;
  Chart.register(...registerables);
  let selectedRun = "Aggregated";

  let selectedOptions = {
    runs5: false,
    buckets5: false,
    explanation: false,
  };

  function toggleOption(option) {
    selectedOptions[option] = !selectedOptions[option];
    console.log("Updated selected options:", selectedOptions);
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
        renderChart();
      } else {
        console.error("Failed to fetch examples");
      }
    } catch (error) {
      console.error("Error fetching examples:", error);
    }
  });

  function renderChartBucket() {
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
        on:change={() => toggleOption("certainty")}
        bind:checked={selectedOptions.certainty}
      />
      Show me how the labels changed across different model runs.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("modelConsistency")}
        bind:checked={selectedOptions.modelConsistency}
      />
      Show me the uncertainty for all labels.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("explanation")}
        bind:checked={selectedOptions.explanation}
      />
      Show me a summary of the explanations.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("explanation")}
        bind:checked={selectedOptions.explanation}
      />
      Show me the relationship between the AI's self-reported certainty and how labels
      changed over 5 runs.
    </label>

    <label class="checkbox-group-c">
      <input
        type="checkbox"
        on:change={() => toggleOption("explanation")}
        bind:checked={selectedOptions.explanation}
      />
      Show me a summary of the explanations.
    </label>
  </div>

  <div style="width:100%">
    <div class="chart-container">
      <canvas bind:this={chartCanvas}></canvas>
    </div>

    <div class="chart-container">
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
    width: 100%;
    height: 400px;
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
