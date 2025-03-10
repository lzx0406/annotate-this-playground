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

  let sampleSize = 10;
  let randomSeed = 2025;
  let showBucket;

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
      // Fetch data from the backend
      const response = await fetch(`/api/getExamples?prompt_id=${id}`);
      if (response.ok) {
        exampleData = await response.json();
        filteredData = [...exampleData];
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

  function filterData() {
    if (!exampleData || exampleData.length === 0) {
      filteredData = [];
      return;
    }

    const rng = seedrandom(randomSeed);
    const shuffled = [...exampleData];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    filteredData = shuffled.slice(0, sampleSize);
  }

  // bucket scripts
  let selectedBucket = "Very Likely";

  const buckets = [
    { name: "Very Likely", color: "#5EE85C" },
    { name: "Somewhat Likely", color: "#BEE85C" },
    { name: "Even Chance", color: "#E8E35C" },
    { name: "Somewhat Unlikely", color: "#E88D5C" },
    { name: "Very Unlikely", color: "#E85C5C" },
    { name: "Self-defined Bucket", color: "#60ACF2" },
  ];

  let bucketStats = {
    "Very Likely": { count: 100, percentage: 20 },
    "Somewhat Likely": { count: 80, percentage: 16 },
    "Even Chance": { count: 90, percentage: 18 },
    "Somewhat Unlikely": { count: 110, percentage: 22 },
    "Very Unlikely": { count: 110, percentage: 22 },
    "Self-defined Bucket": { count: 120, percentage: 24 },
  };

  function filterByBucket(bucketName) {
    selectedBucket = bucketName;
    // Apply your filtering logic here based on the bucket
    console.log(`Filtering by: ${bucketName}`);
  }
</script>

<section class="head">
  <nav>
    <!-- Logo -->
    <div class="nav-left">
      <img src="/imgs/logo.png" alt="AnnotateThis" class="logo" />
      <h1 style="vertical-align: middle; margin:3% 0% 0% 8%;">
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

<section>
  <div class="top">
    <!-- <a href={`../prompts`}><Fa icon={faHouse} /> Back to My Prompts </a>
    <h1>Annotation Examples</h1> -->
    <p>Prompt {idshow}</p>
    <p>{formatTimeSubmitted(timeP)}</p>
    <p>{textP}</p>
  </div>
</section>

<section
  style="
    margin: 20px 5%;
    padding: 20px;
    background-color: #f9f9f9;
    border-radius: 10px;
  "
>
  <div
    style="display: flex; gap: 10px; margin-bottom: 20px; justify-content:space-between;"
  >
    {#each buckets as bucket}
      <button
        on:click={() => filterByBucket(bucket.name)}
        style="
          padding: 10px 50px;
          border-radius: 8px;
          border: none;
          color:black;
          background-color: {bucket.color};
          font-weight: bold;
          cursor: pointer;
          opacity: {selectedBucket === bucket.name ? 1 : 0.7};
          border-bottom: {selectedBucket === bucket.name
          ? '3px solid #444'
          : 'none'};
        "
      >
        {bucket.name}
      </button>
    {/each}
  </div>

  <div
    style="display: flex; justify-content: space-between; align-items: center;"
  >
    <div>
      <p>Number of instances: {bucketStats[selectedBucket].count}</p>
      <p>Percentage: {bucketStats[selectedBucket].percentage}%</p>
    </div>
    <!-- <button
      on:click={() => filterByBucket(selectedBucket)}
      style="
        padding: 10px 20px;
        background-color: #5facf2;
        color: white;
        border: none;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
      "
    >
      Show examples in this bucket
    </button> -->
  </div>
</section>

<div style="display: flex; align-items: center; gap: 8px; margin: 0 5% 0 5%;">
  <label for="sampleSize" style="font-weight: bold;">Show</label>
  <select
    id="sampleSize"
    bind:value={sampleSize}
    on:change={filterData}
    style="
      padding: 5px 10px;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 14px;
    "
  >
    <option value="10" selected="selected">10</option>
    <option value="25">25</option>
    <option value="50">50</option>
    <option value="100">100</option>
  </select>
  <span style="font-weight: bold;">annotation examples from bucket</span>
  <select
    id="showBucket"
    bind:value={showBucket}
    on:change={filterByBucket}
    style="
      padding: 5px 10px;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 14px;
    "
  >
    <option value="very likely">Very Likely</option>
    <option value="somewhat likely">Somewhat Likely</option>
    <option value="even chance">Even Chance</option>
    <option value="somewhat unlikely">Somewhat Unlikely</option>
    <option value="very unlikely">Very Unlikely</option>
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
            <th style="width: 10%;">Article URL</th>
            <th style="width: 70%;">Article Text</th>
            <th>Predicted Value</th>
            <th>Bucket</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredData as row}
            <tr>
              <td
                >{exampleData.findIndex((originalRow) => originalRow === row) +
                  1}</td
              >
              <!-- Dynamically calculate the original index -->
              <td>
                <a
                  href={row.article_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style="
                    display: inline-block;
                    width: 100%;
                    white-space: wrap;
                    overflow:scroll;
                    text-overflow: ellipsis;
                  "
                >
                  {row.article_url}
                </a>
              </td>
              <td>{row.text}</td>
              <td>{row.predicted_value ? "Yes" : "No"}</td>
              <td>Very Likely</td>
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
    overflow: scroll;
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
    table-layout: fixed;
    width: 100%;
    border-collapse: collapse;
    margin: 25px 0;
    font-size: 0.9em;
    /* font-family: "Arial", sans-serif; */
    border-radius: 5px 5px 0 0;
    overflow: hidden;
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
</style>
