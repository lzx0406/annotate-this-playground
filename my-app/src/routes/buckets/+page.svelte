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

  import {
    selectedAnnotationType,
    userId,
    userName,
    prompts,
  } from "$lib/stores";
  let promptList = [];
  let exampleData = [];

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
  let initedData = [];

  let filteredCopy = [];

  const bucketRanges = {
    All: [0.0, 1.0],
    "Very Likely": [0.8, 1.0], // 0.8 ≤ P ≤ 1.0
    "Somewhat Likely": [0.6, 0.8], // 0.6 ≤ P < 0.8
    "Even Chance": [0.4, 0.6], // 0.4 ≤ P < 0.6
    "Somewhat Unlikely": [0.2, 0.4], // 0.2 ≤ P < 0.4
    "Very Unlikely": [0.0, 0.2], // 0.0 ≤ P < 0.2
  };

  let selectedBucket = "All";

  function filterByBucket(bucketName) {
    selectedBucket = bucketName;
    const [minProb, maxProb] = bucketRanges[bucketName] || [0.0, 1.0];

    filteredData = initedData.filter(
      (row) =>
        row.probability !== undefined &&
        row.probability >= minProb &&
        row.probability < maxProb
    );

    filteredCopy = filteredData;
    console.log(
      `Filtered by bucket: ${selectedBucket}, found ${filteredData.length} results`
    );
  }

  function initData() {
    // Group annotations by article_url
    const groupedAnnotations = {};
    exampleData.forEach((row) => {
      if (!groupedAnnotations[row.article_url]) {
        groupedAnnotations[row.article_url] = [];
      }
      groupedAnnotations[row.article_url].push(row);
    });

    console.log("Grouped Annotations by article_url:", groupedAnnotations);

    Object.values(groupedAnnotations).forEach((group) => {
      group.sort((a, b) => a.perturbation_index - b.perturbation_index);
    });

    initedData = exampleData
      .filter((row) => row.perturbation_index === 0)
      .map((row) => {
        const perturbations = groupedAnnotations[row.article_url] || [];

        const basePrediction = row.predicted_value;

        console.log(
          `Processing article_id: ${row.article_url}, basePrediction: ${basePrediction}`
        );

        // next 4 perturbations
        const matchingPerturbations = perturbations
          .filter((p) => p.perturbation_index >= 1 && p.perturbation_index <= 4)
          .filter((p) => p.predicted_value === basePrediction);

        const agreementCount = matchingPerturbations.length;

        console.log(
          `Agreement for article_id ${row.article_url}: ${agreementCount}/4`
        );

        return {
          ...row,
          agreement_display: `${agreementCount + 1}/5`,
          agreement_score: agreementCount,
        };
      });

    console.log(`Init found ${initedData.length} results`);

    // average agreement across the filtered dataset
    const totalAgreement = initedData.reduce(
      (sum, row) => sum + row.agreement_score,
      0
    );
    const averageAgreement =
      initedData.length > 0
        ? (totalAgreement / (initedData.length * 4)) * 4 // Keep fraction representation
        : 0;

    console.log(`Average Agreement Score: ${averageAgreement.toFixed(2)}/4`);
    filteredData = initedData;
    filteredCopy = filteredData;
  }

  function filterBySampleSize(sampleSize) {
    if (!initedData || initedData.length === 0) {
      filteredData = [];
      return;
    }

    if (sampleSize == 0) {
      filteredData = initedData;
      console.log("Not filtering by sample size yet");
      return;
    }

    const rng = seedrandom(randomSeed);
    filteredData = initedData
      .sort(() => rng() - 0.5) // Shuffle
      .slice(0, sampleSize); // Limit to sample size

    filteredCopy = filteredData;
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
      const response = await fetch(
        `/api/getExamples?prompt_id=${id}&writer_id=${$userId}`
      );
      if (response.ok) {
        exampleData = await response.json();
        initData();
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

  const buckets = [
    { name: "All", color: "#FFFFFF" },
    { name: "Very Likely", color: "#9b59b6" },
    { name: "Somewhat Likely", color: "#9b59b6" },
    { name: "Even Chance", color: "#E8E35C" },
    { name: "Somewhat Unlikely", color: "#E88D5C" },
    { name: "Very Unlikely", color: "#E85C5C" },
  ];

  const sampleSizes = [
    { name: "All", num: 0 },
    { name: "10", num: 10 },
    { name: "20", num: 20 },
    { name: "30", num: 30 },
    { name: "40", num: 40 },
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
      return { label: "Very Unlikely", color: "#EEE3F3", textColor: "black" }; // Light purple
    } else if (probability < 0.4) {
      return {
        label: "Somewhat Unlikely",
        color: "#DCC4E5",
        textColor: "black",
      };
    } else if (probability < 0.6) {
      return { label: "Even Chance", color: "#C39AD3", textColor: "black" };
    } else if (probability < 0.8) {
      return { label: "Somewhat Likely", color: "#A56ABD", textColor: "white" };
    } else {
      return { label: "Very Likely", color: "#8132A1", textColor: "white" }; // Dark purple
    }
  }

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

  let expandedRows = writable({});
  let expandedRowsExp = writable({});

  function toggleExpand(index, exps) {
    exps.update((rows) => {
      let newRows = { ...rows };
      newRows[index] = !newRows[index];
      return newRows;
    });
  }

  // sorting
  let sortKey = writable(null);
  let sortOrder = writable(1); // 1 for ascending, -1 for descending

  function sortBy(key) {
    if ($sortKey === key) {
      if ($sortOrder === 1) {
        sortOrder.set(-1);
      } else if ($sortOrder === -1) {
        sortKey.set(null); // reset
        sortOrder.set(null);
        filteredData = filteredCopy;
        return;
      }
    } else {
      sortKey.set(key);
      sortOrder.set(1); // default to ascending on new column selection
    }

    if ($sortKey) {
      filteredData = [...filteredData].sort((a, b) => {
        let aValue = a[key] ?? "";
        let bValue = b[key] ?? "";

        if (typeof aValue === "boolean") {
          return $sortOrder * (aValue === bValue ? 0 : aValue ? 1 : -1);
        }

        if (typeof aValue === "string" && typeof bValue === "string") {
          return $sortOrder * aValue.localeCompare(bValue);
        }

        return $sortOrder * (aValue - bValue);
      });
    }
  }

  $: articleTextClass =
    selectedOptions.certainty ||
    selectedOptions.modelConsistency ||
    selectedOptions.explanation
      ? "shrink-column" // Apply reduced width
      : "wide-column"; // Default full width
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
        Concept Exploration
      </h1>
    </div>

    <!-- User -->
    <div class="nav-right">
      <h1 style="margin:0% 15% 0% 0%;">{get(userName)}</h1>
      <img src="/imgs/user-icon.png" alt="User Icon" class="user-icon" />
    </div>
  </nav>
</section>

<div class="checkbox-group">
  <label class="checkbox-group-c certainty-btn">
    <input
      type="checkbox"
      on:change={() => toggleOption("certainty")}
      bind:checked={selectedOptions.certainty}
    />
    <!-- I want to see how certain the AI is about these labels -->
    <!-- AI Certainty <span><Fa icon={faCircleInfo} style="opacity: 0.5;" /></span> -->
    AI Certainty
    <span
      class="tooltip-container"
      data-tooltip="We asked the AI verbally to give us an estimate of its certainty on its answer, 
      we included in the prompt: P: <the probability between 0.0 and 1.0 that [the guess] is correct, 
      without any extra commentary whatsoever; just the probability!> Select to view in the table."
    >
      <Fa icon={faCircleInfo} style="opacity: 0.5;" />
    </span>
  </label>

  <label class="checkbox-group-c consistency-btn">
    <input
      type="checkbox"
      on:change={() => toggleOption("modelConsistency")}
      bind:checked={selectedOptions.modelConsistency}
    />
    <!-- I want to see if the AI makes the same predictions when the model is run 5 times -->
    Prediction Consistency
    <span
      class="tooltip-container"
      data-tooltip="We ran the same model for 5 times with a temperature of 0.7 (the answer the AI gives is non-deterministic,
       and would vary across runs), this number shows how many times out of all 5 runs the AI agrees with the answer from first run.
       Select to view in the table."
    >
      <Fa icon={faCircleInfo} style="opacity: 0.5;" />
    </span>
  </label>

  <label class="checkbox-group-c explanation-btn">
    <input
      type="checkbox"
      on:change={() => toggleOption("explanation")}
      bind:checked={selectedOptions.explanation}
    />
    <!-- I want to see the AI's explanations -->
    AI Explanations
    <span
      class="tooltip-container"
      data-tooltip="We asked AI to give us an explanation for its answer by including in the prompt: Explanation: <include your explanation here.>
      Select to view in the table."
    >
      <Fa icon={faCircleInfo} style="opacity: 0.5;" />
    </span>
  </label>
</div>

<section>
  <!-- <a href={`../prompts`}><Fa icon={faHouse} /> Back to My Prompts </a>
    <h1>Annotation Examples</h1> -->
  <div class="top">
    <p>
      <span style="font-weight:bold">Prompt {idshow} </span>
      ({formatTimeSubmitted(timeP)})
    </p>
    <p>{textP}</p>
  </div>
</section>

<div style="display: flex; align-items: center; gap: 8px; margin: 0 5% 0 5%;">
  <label for="sampleSize" style="font-weight: bold;">Show</label>
  <select
    id="sampleSize"
    bind:value={sampleSize}
    on:change={() => filterBySampleSize(sampleSize)}
    style="padding: 5px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px;"
  >
    {#each sampleSizes as size}
      <option value={size.num}>{size.name}</option>
    {/each}
  </select>
  <span style="font-weight: bold;"
    >annotation examples from certainty bucket</span
  >
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
            <th
              class={articleTextClass}
              style="white-space:normal; max-width: 400px;">Article Text</th
            >

            <th class="sortable" on:click={() => sortBy("predicted_value")}>
              <div class="header-content">
                Run 1 Predicted Value
                <div class="arrow-container">
                  <span
                    class="arrow {$sortKey === 'predicted_value' &&
                    $sortOrder === 1
                      ? 'active'
                      : ''}"
                  >
                    ▲
                  </span>
                  <span
                    class="arrow {$sortKey === 'predicted_value' &&
                    $sortOrder === -1
                      ? 'active'
                      : ''}"
                  >
                    ▼
                  </span>
                </div>
                <!-- <span><Fa icon={faCircleInfo} style="opacity: 0.5;" /></span> -->
              </div>
            </th>

            {#if selectedOptions.certainty}
              <th
                class="sortable certainty-header"
                on:click={() => sortBy("probability")}
              >
                <div class="header-content">
                  Run 1 Certainty
                  <div class="arrow-container">
                    <span
                      class="arrow {$sortKey === 'probability' &&
                      $sortOrder === 1
                        ? 'active'
                        : ''}"
                    >
                      ▲
                    </span>
                    <span
                      class="arrow {$sortKey === 'probability' &&
                      $sortOrder === -1
                        ? 'active'
                        : ''}"
                    >
                      ▼
                    </span>
                  </div>
                </div>
              </th>
            {/if}

            {#if selectedOptions.modelConsistency}
              <!-- Model Consistency -->
              <th
                class="sortable consistency-header"
                on:click={() => sortBy("agreement_score")}
              >
                <div class="header-content">
                  Model Consistency
                  <div class="arrow-container">
                    <span
                      class="arrow {$sortKey === 'agreement_score' &&
                      $sortOrder === 1
                        ? 'active'
                        : ''}"
                    >
                      ▲
                    </span>
                    <span
                      class="arrow {$sortKey === 'agreement_score' &&
                      $sortOrder === -1
                        ? 'active'
                        : ''}"
                    >
                      ▼
                    </span>
                  </div>
                </div>
              </th>
            {/if}

            {#if selectedOptions.explanation}
              <th class="explanation-header" style="width: 5%;">Explanation</th>
            {/if}
          </tr>
        </thead>
        <tbody>
          {#each filteredData as row, i}
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
                  {row.article_url.slice(28, 60)}
                </a>
              </td>
              <td
                class={articleTextClass}
                style="width:100%; display:flex; flex-direction:row"
                on:click={() => toggleExpand(i, expandedRows)}
              >
                {#if $expandedRows[i]}
                  <p style="white-space:wrap;">
                    <Fa icon={faChevronDown} style="color: #5facf2" /> &nbsp; {row.text}
                  </p>
                {:else}
                  <p
                    style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                  >
                    <Fa icon={faChevronRight} style="color: #5facf2" /> &nbsp; {row.text.slice(
                      0,
                      100
                    )}
                  </p>
                {/if}
              </td>
              <td
                style="font-weight:bold; color: {row.predicted_value
                  ? '#66bb6a'
                  : '#ef5350'};">{row.predicted_value ? "Yes" : "No"}</td
              >

              {#if selectedOptions.certainty}
                {#if row.probability !== undefined}
                  <td style="text-align: center;">
                    <span
                      style="
                        background-color: {getConfidenceLevel(row.probability)
                        .color};
                        color: {getConfidenceLevel(row.probability).textColor};
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
                <td style="font-weight:bold"
                  >{row.agreement_display} runs agree with
                  <span
                    style="color: {row.predicted_value ? '#66bb6a' : '#ef5350'}"
                    >{row.predicted_value ? "Yes" : "No"}</span
                  ></td
                >
              {/if}

              {#if selectedOptions.explanation}
                <td
                  style="display:flex; flex-direction:row"
                  on:click={() => toggleExpand(i, expandedRowsExp)}
                >
                  {#if $expandedRowsExp[i]}
                    <p style="width:100%; white-space:wrap">
                      <Fa icon={faChevronDown} style="color: #5facf2" /> &nbsp; {row.explanation}
                    </p>
                  {:else}
                    <p
                      style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                    >
                      <Fa icon={faChevronRight} style="color: #5facf2" /> &nbsp;
                      {row.explanation.slice(0, 100)}
                    </p>
                  {/if}
                </td>
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
    /* font-size: 18px; */
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
    width: 90%;
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
    /* width: max-content; */
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
    /* justify-content: space-around; */
    gap: 5%;
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

  /* button coloring */
  .certainty-btn {
    border-color: #9b59b6;
    color: #9b59b6;
  }
  .certainty-btn:hover,
  .certainty-btn:has(input:checked) {
    background-color: #9b59b6;
    color: white;
  }
  .certainty-header {
    background-color: rgb(235, 203, 248);
  }

  .consistency-btn {
    border-color: #66bb6a;
    color: #66bb6a;
  }
  .consistency-btn:hover,
  .consistency-btn:has(input:checked) {
    background-color: #66bb6a;
    color: white;
  }
  .consistency-header {
    background-color: rgb(195, 239, 197);
  }

  .explanation-btn {
    border-color: #e67e22;
    color: #e67e22;
  }
  .explanation-btn:hover,
  .explanation-btn:has(input:checked) {
    background-color: #e67e22;
    color: white;
  }
  .explanation-header {
    background-color: rgb(246, 212, 182);
  }

  .sortable {
    cursor: pointer;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .arrow-container {
    display: flex;
    flex-direction: column;
    line-height: 1;
    justify-content: center;
    align-items: center;
  }

  .arrow {
    font-size: 10px;
    color: gray;
    transition: color 0.2s;
  }

  .active {
    color: black;
  }

  /* for article text */
  .wide-column {
    width: 60%;
    /* max-width: 500px; */
    white-space: normal;
    transition: width 0.3s ease-in-out;
  }

  .shrink-column {
    width: 20%;
    max-width: 450px;
    white-space: normal;
    transition: width 0.3s ease-in-out;
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
