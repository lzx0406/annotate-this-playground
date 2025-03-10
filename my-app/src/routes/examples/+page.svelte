<script>
  // @ts-nocheck

  import { writable } from "svelte/store";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { getContext } from "svelte";
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
    filteredData = exampleData.filter((row) => {
      // console.log("FILTERINGGGGGGGG");
      let include = true;

      const truth = row["true_value"];
      // console.log(truth);
      const prediction = row["predicted_value"];

      if (predValue) {
        if (predValue === "Yes") {
          include = include && prediction;
        } else if (predValue === "No") {
          include = include && !prediction;
        }
      }

      if (trueValue) {
        if (trueValue === "Yes") {
          include = include && truth;
        } else if (trueValue === "No") {
          include = include && !truth;
        }
      }

      if (showWrongPredictions) {
        include = include && truth != prediction;
      }

      // console.log(include);
      return include;
    });
  }
</script>

<section>
  <div class="top">
    <a href={`../prompts`}><Fa icon={faHouse} /> Back to My Prompts </a>
    <h1>Annotation Examples</h1>
    <p>Prompt {idshow}</p>
    <p>{formatTimeSubmitted(timeP)}</p>
    <p>{textP}</p>
  </div>
</section>

<section class="filters-and-metrics">
  <div class="filter">
    <h3 style="margin-bottom: 0px; margin-top:0px;">Filter Examples</h3>
    <p style="margin-top:0px; color:#666666; font-size:small;">
      Define filters to view a subset of the examples based on selected criteria
    </p>

    <div style="display: flex; justify-content: space-between;">
      <div class="adjust-filters">
        <!-- <div style="margin-bottom: 1.5%">
          <label>Label</label>
          <select bind:value={selectedLabel}>
            {#each columnHeaders as label}
              <option value={label}>{label}</option>
            {/each}
          </select>
        </div> -->

        <div style="margin-bottom: 1.5%">
          <label>Predicted value according to your prompt and the AI</label>
          <select bind:value={predValue}>
            <option value="">All</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>

        <div style="margin-bottom: 1.5%">
          <label>True value according to researcher</label>
          <select bind:value={trueValue}>
            <option value="">All</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>

        <div style="margin-bottom: 1.5%">
          <!-- svelte-ignore a11y-label-has-associated-control -->
          <label>
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
              style="cursor: pointer; display: flex; align-items: center;"
              on:click={() => (showWrongPredictions = !showWrongPredictions)}
            >
              <Fa
                icon={showWrongPredictions ? faToggleOn : faToggleOff}
                style="color:#5facf2; font-size: 1.5rem;"
              />
              <span style="margin-left: 10px;">
                Show only incorrect predictions
              </span>
            </div>
          </label>
        </div>

        <button on:click={filterData} style="margin-top: 2%"
          >Apply Filters</button
        >
      </div>
    </div>
  </div>

  <div class="all-data">
    <h2>
      Filtered Examples for <span style="color:#188df9"
        >{$selectedAnnotationType}
      </span>
    </h2>
    {#if filteredData.length > 0}
      <table class="styled-table">
        <thead>
          <tr>
            <th style="width: 5%;"></th>
            <th style="width: 10%;">Article URL</th>
            <th style="width: 70%;">Article Text</th>
            <th>Predicted Value</th>
            <th>True Value</th>
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
              <td>{row.true_value ? "Yes" : "No"}</td>
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
