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

  Chart.register(...registerables);

  let chartCanvas;

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

<div class="chart-container">
  <canvas bind:this={chartCanvas}></canvas>
</div>

<style>
  .chart-container {
    width: 80%;
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
</style>
