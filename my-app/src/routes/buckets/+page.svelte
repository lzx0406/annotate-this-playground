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
  } from "@fortawesome/free-solid-svg-icons";

  import {
    selectedAnnotationType,
    userId,
    userName,
    prompts,
  } from "$lib/stores";
  let promptList = [];
  let exampleData = [];
  // let exampleData = writable([]);

  // Subscribe to the store
  // $: prompts.subscribe((/** @type {any[]} */ value) => {
  //   console.log("Current prompts:", value);
  //   promptList = value;
  // });

  const query = $page.url.searchParams;
  const title = query.get("title");
  const id = query.get("id");
  const idshow = query.get("idshow");

  let filteredData = [];

  let predValue = "";
  let trueValue = "";
  let showWrongPredictions = false;
  let textP, timeP;

  let sampleSize = 0;
  let randomSeed = 2025;
  let showBucket;

  let filteredByBucket = [];

  // Map bucket name to exclusive probability ranges
  const bucketRanges = {
    "Very Likely": [0.8, 1.0], // 0.8 ≤ P ≤ 1.0
    "Somewhat Likely": [0.6, 0.8], // 0.6 ≤ P < 0.8
    "Even Chance": [0.4, 0.6], // 0.4 ≤ P < 0.6
    "Somewhat Unlikely": [0.2, 0.4], // 0.2 ≤ P < 0.4
    "Very Unlikely": [0.0, 0.2], // 0.0 ≤ P < 0.2
  };

  // Ensure `selectedBucket` starts with a valid value
  let selectedBucket = "Very Likely";

  function filterByBucket(bucketName) {
    selectedBucket = bucketName; // Update the bucket state

    const [minProb, maxProb] = bucketRanges[bucketName] || [0, 1];

    filteredByBucket = exampleData.filter(
      (row) =>
        row.probability !== undefined &&
        row.probability >= minProb &&
        row.probability < maxProb // Exclusive max
    );

    console.log(
      `Filtered by bucket: ${selectedBucket}, found ${filteredByBucket.length} results`
    );

    filterBySampleSize();
  }

  function filterBySampleSize() {
    if (!filteredByBucket || filteredByBucket.length === 0) {
      filteredData = [];
      return;
    }

    if (sampleSize == 0) {
      filteredData = filteredByBucket;
      return;
    }

    const rng = seedrandom(randomSeed);
    filteredData = filteredByBucket
      .sort(() => rng() - 0.5) // Shuffle
      .slice(0, sampleSize); // Limit to sample size

    console.log(
      `Applied sample size filter: showing ${filteredData.length} results`
    );
  }

  console.log("MOUNTINGGGGGGG0");
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
      // Fetch data from backend
      const response = await fetch(`/api/getExamples?prompt_id=${id}`);
      if (response.ok) {
        exampleData = await response.json();
        filterByBucket(selectedBucket); // Ensure filtering applies on first load
      } else {
        console.error("Failed to fetch examples");
      }
    } catch (error) {
      console.error("Error fetching examples:", error);
    }
  });

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

  // function filterData() {
  //   if (!exampleData || exampleData.length === 0) {
  //     filteredData = [];
  //     return;
  //   }

  //   const rng = seedrandom(randomSeed);
  //   const shuffled = [...exampleData];

  //   for (let i = shuffled.length - 1; i > 0; i--) {
  //     const j = Math.floor(rng() * (i + 1));
  //     [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  //   }

  //   filteredData = shuffled.slice(0, sampleSize);
  // }

  // bucket scripts

  const buckets = [
    { name: "Very Likely", color: "#5EE85C" },
    { name: "Somewhat Likely", color: "#BEE85C" },
    { name: "Even Chance", color: "#E8E35C" },
    { name: "Somewhat Unlikely", color: "#E88D5C" },
    { name: "Very Unlikely", color: "#E85C5C" },
    // { name: "Self-defined Bucket", color: "#60ACF2" },
  ];

  let bucketStats = {
    "Very Likely": { count: 100, percentage: 20 },
    "Somewhat Likely": { count: 80, percentage: 16 },
    "Even Chance": { count: 90, percentage: 18 },
    "Somewhat Unlikely": { count: 110, percentage: 22 },
    "Very Unlikely": { count: 110, percentage: 22 },
    // "Self-defined Bucket": { count: 120, percentage: 24 },
  };

  function getConfidenceLevel(probability) {
    if (probability < 0.2) {
      return { label: "Very Unlikely", color: "#E85C5C" }; // Red
    } else if (probability < 0.4) {
      return { label: "Somewhat Unlikely", color: "#E88D5C" }; // Orange
    } else if (probability < 0.6) {
      return { label: "Even Chance", color: "#E8E35C" }; // Yellow
    } else if (probability < 0.8) {
      return { label: "Somewhat Likely", color: "#BEE85C" }; // Light Green
    } else {
      return { label: "Very Likely", color: "#5EE85C" }; // Green
    }
  }

  // function filterByBucket(bucketName) {
  //   selectedBucket = bucketName;
  //   // Apply your filtering logic here based on the bucket
  //   console.log(`Filtering by: ${bucketName}`);
  // }

  // For page options
  // let selectedOption = writable(null);

  // function setOption(option) {
  //   selectedOption.update((current) => (current === option ? null : option));
  // }
  // Track selected options using an object
  let selectedOptions = {
    certainty: false,
    modelConsistency: false,
    explanation: false,
  };

  // Toggle options when checkboxes change
  function toggleOption(option) {
    selectedOptions[option] = !selectedOptions[option];
    console.log("Updated selected options:", selectedOptions);
  }
</script>

<section class="head">
  <nav>
    <!-- Logo -->
    <div class="nav-left">
      <img src="/imgs/logo.png" alt="AnnotateThis" class="logo" />
      <h1 style="white-space: nowrap; margin:3% 0% 0% 8%;">
        Concept Exploration
      </h1>
    </div>

    <!-- User -->
    <div class="nav-right">
      <h1 style="margin:0% 20% 0% 0%;">{get(userName)}</h1>
      <img src="/imgs/user-icon.png" alt="User Icon" class="user-icon" />
    </div>
  </nav>
</section>

<div class="checkbox-group">
  <label class="checkbox-group-c">
    <input
      type="checkbox"
      on:change={() => toggleOption("certainty")}
      bind:checked={selectedOptions.certainty}
    />
    I want to see how certain the AI is about these labels
  </label>

  <label class="checkbox-group-c">
    <input
      type="checkbox"
      on:change={() => toggleOption("modelConsistency")}
      bind:checked={selectedOptions.modelConsistency}
    />
    I want to see if the AI makes the same predictions if I change some of the model
    settings
  </label>

  <label class="checkbox-group-c">
    <input
      type="checkbox"
      on:change={() => toggleOption("explanation")}
      bind:checked={selectedOptions.explanation}
    />
    I want to see the AI's explanations
  </label>
</div>

<section>
  <div class="top">
    <!-- <a href={`../prompts`}><Fa icon={faHouse} /> Back to My Prompts </a>
    <h1>Annotation Examples</h1> -->
    <p>Prompt {idshow}</p>
    <p>{formatTimeSubmitted(timeP)}</p>
    <p>{textP}</p>
  </div>
</section>

<div style="display: flex; align-items: center; gap: 8px; margin: 0 5% 0 5%;">
  <label for="sampleSize" style="font-weight: bold;">Show</label>
  <select
    id="sampleSize"
    bind:value={sampleSize}
    on:change={filterBySampleSize}
    style="padding: 5px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px;"
  >
    <option value="0">All</option>
    <option value="10">10</option>
    <option value="25">25</option>
    <option value="50">50</option>
    <option value="100">100</option>
  </select>
  <span style="font-weight: bold;">annotation examples from bucket</span>
  <select
    id="showBucket"
    bind:value={selectedBucket}
    on:change={() => filterByBucket(selectedBucket)}
    style="padding: 5px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px;"
  >
    {#each buckets as bucket}
      <option value={bucket.name}>{bucket.name}</option>
    {/each}
  </select>
</div>

<section>
  <div class="all-data">
    <!-- <h2>
      Filtered Examples for <span style="color:#188df9"
        >{$selectedAnnotationType}
      </span>
    </h2> -->
    {#if filteredData.length > 0}
      <table class="styled-table">
        <thead>
          <tr>
            <th style="width: 5%;"></th>
            <th style="width: 10%; max-width: 100px;">Article URL</th>
            <th style="width: 40%; white-space:normal; max-width: 500px;"
              >Article Text</th
            >
            <th style="width: 8%;">Predicted Value</th>

            {#if selectedOptions.certainty}
              <th style="width: 5%; max-width: 100px">Certainty</th>
            {/if}

            {#if selectedOptions.modelConsistency}
              <th style="width: 5%;max-width: 100px">Model Consistency</th>
            {/if}

            {#if selectedOptions.explanation}
              <th style="width: 8%;">Explanation</th>
            {/if}
          </tr>
        </thead>
        <tbody>
          {#each filteredData as row}
            <tr>
              <td
                >{filteredData.findIndex((originalRow) => originalRow === row) +
                  1}</td
              >
              <td>
                <a
                  href={row.article_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style="display: inline-block;
                  white-space: wrap;
                  max-width: 100px;
                  overflow:scroll;
                  text-overflow: ellipsis;
                "
                >
                  {row.article_url}
                </a>
              </td>
              <td style="width: 40%; white-space:wrap; max-width: 500px;"
                >{row.text}</td
              >
              <td>{row.predicted_value ? "Yes" : "No"}</td>

              {#if selectedOptions.certainty}
                {#if row.probability !== undefined}
                  <td style="text-align: center;">
                    <span
                      style="
                        background-color: {getConfidenceLevel(row.probability)
                        .color};
                        color: black;
                        font-weight: bold;
                        padding: 4px 10px;
                        border-radius: 10px;
                        display: inline-block;
                      "
                    >
                      {getConfidenceLevel(row.probability).label} ({row.probability})
                      that {row.predicted_value ? "Yes" : "No"} is correct
                    </span>
                  </td>
                {/if}
              {/if}

              {#if selectedOptions.modelConsistency}
                <td
                  >3/5 models agree with {row.predicted_value ? "Yes" : "No"}
                  {row.model_consistency}</td
                >
              {/if}

              {#if selectedOptions.explanation}
                <td>{row.explanation}</td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p>No data to display. Apply filters to see the results.</p>
    {/if}
  </div>
</section>

<style>
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
    padding: 16px;
    /* border-bottom: 1px solid #e5e7eb; */
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 18px;
  }

  .nav-left,
  .nav-center,
  .nav-right {
    display: flex;
    align-items: center;
  }

  .nav-center a {
    margin: 0 12px;
    text-decoration: none;
    color: #6b7280;
    font-weight: 500;
  }

  .nav-center a:first-child {
    color: #1f2937;
    font-weight: 700;
  }

  .nav-right span {
    font-weight: 700;
    color: #1f2937;
    margin-right: 8px;
  }

  .logo {
    height: 32px;
  }

  .user-icon {
    height: 24px;
    width: 24px;
    border-radius: 50%;
  }

  .filter {
    margin: 0% 5% 3% 5%;
    background-color: #fafafa;
    padding: 2%;
    border-radius: 10px;
  }

  .adjust-filters {
    width: 50%;
  }

  .all-data {
    margin: 0% 5% 3% 5%;
    width: 100%;
    overflow-x: auto;
    white-space: nowrap;
  }

  button {
    background-color: #5facf2;
    color: white;
    border: none;
    padding: 8px 15px;
    cursor: pointer;
    border-radius: 5px;
  }

  .styled-table {
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;

    /* table-layout: fixed; */
    /* width: 100%; */
    margin: 25px 0;
    font-size: 0.9em;
    /* font-family: "Arial", sans-serif; */
    border-radius: 5px 5px 0 0;
    overflow: scroll;
    border-radius: 1em;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  }

  .styled-table thead tr {
    background-color: #5fabf232;
    /* color: #ffffff; */
    text-align: left;
    font-weight: bold;
  }

  .styled-table th,
  .styled-table td {
    padding: 12px 15px;
    border: 1px solid #dddddd;
    text-align: left;
  }

  .styled-table tbody tr {
    border-bottom: 1px solid #dddddd;
  }

  .styled-table tbody tr:nth-of-type(even) {
    background-color: #f3f3f3;
  }

  .styled-table tbody tr:last-of-type {
    border-bottom: 2px solid #5facf2;
  }

  .styled-table tbody tr:hover {
    background-color: #f1f1f1;
  }

  .styled-table tbody tr td a {
    color: #5facf2;
    text-decoration: none;
  }

  .styled-table tbody tr td a:hover {
    text-decoration: underline;
  }

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

  .checkbox-group {
    display: flex;
    flex-direction: row;
    gap: 20px; /* Space between buttons */
    margin: 2% 5% 2% 5%;
  }

  /* General button style */
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
