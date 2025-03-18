<script>
  // @ts-nocheck

  import { writable } from "svelte/store";
  import { get } from "svelte/store";
  import { setContext } from "svelte";
  import { onMount, onDestroy } from "svelte";

  import fs from "fs/promises"; // For writing JSONL files

  import { goto } from "$app/navigation";

  import { getContext } from "svelte";
  import Fa from "svelte-fa";
  import {
    faChevronLeft,
    faChevronRight,
    faChevronDown,
    faHouse,
  } from "@fortawesome/free-solid-svg-icons";

  import {
    waitingForAnnotation,
    pendingPrompt,
    selectedAnnotationType,
    userId,
    userName,
    prompts,
    latestProgress,
    numAnnotated,
  } from "$lib/stores";

  let promptList = [];
  let prompt_id, text, prompt_type, time_submitted, metrics;
  let adminData, admin_p_id;
  let timeElapsed = 0;
  let minutes, seconds, formattedTime;
  let interval;
  console.log("GETTT waiting for annotation:" + $waitingForAnnotation);
  console.log("GETTT Latest:" + $latestProgress);
  console.log("GETTT numAnnn:" + $numAnnotated);

  let showPopup = false;
  let newAddingPrompt;

  onMount(() => {
    if (!get(userId) || !get(userName)) {
      logout();
    }
    fetchPastPrompts();
  });

  onMount(() => {
    const currentPrompt = get(pendingPrompt);
    const currentProgress = get(latestProgress);
    console.log("AFTER REFRESH got prompt" + currentPrompt);
    console.log("AFTER REFRESH got latest" + currentProgress);

    if (
      currentPrompt &&
      currentProgress !== "annotation completed" &&
      currentProgress !== "error sending data to OpenAI" &&
      currentProgress !== "waiting for annotation task"
    ) {
      waitingForAnnotation.set(true);
      console.log("AFTER REFRESH got YES still annotating");
    } else {
      waitingForAnnotation.set(false);
      numAnnotated.set("0");
      console.log("AFTER REFRESH NOT still annotating");
    }
  });

  onMount(() => {
    const storedTimestamp = localStorage.getItem("annotationStartTimestamp");
    if (storedTimestamp && $waitingForAnnotation) {
      manageTimer();
    }
  });

  async function fetchPastPrompts() {
    const userIdValue = get(userId); // Get the latest value of userId

    if (!userIdValue) {
      console.error("User ID is missing");
      return;
    }

    try {
      // Fetch prompts for the user
      const response = await fetch(`/prompts?userId=${userIdValue}`);

      if (response.ok) {
        const data = await response.json();

        // Filter to only include prompts with perturbation_index = 0
        const filteredPrompts = data.filter(
          (prompt) => prompt.perturbation_index === 0
        );

        // Process each prompt to ensure metrics are available
        const updatedPrompts = filteredPrompts.map((prompt) => {
          if (typeof prompt.metrics === "string") {
            try {
              prompt.metrics = JSON.parse(prompt.metrics);
            } catch (error) {
              console.error("Error parsing metrics JSON:", error);
            }
          }
          return prompt;
        });

        // Update the Svelte store with the filtered data
        prompts.set(updatedPrompts);

        console.log(
          "Updated prompts with metrics (filtered perturbation = 0):",
          updatedPrompts
        );
      } else {
        console.error("Failed to fetch prompts");
      }
    } catch (error) {
      console.error("Error fetching prompts:", error);
    }
  }

  //fetch admin data
  onMount(async () => {
    console.log("HEREEEEEE" + $selectedAnnotationType);
    // if ($selectedAnnotationType === "call to action") {
    //   admin_p_id = 4;
    // } else if ($selectedAnnotationType === "concern wildlife") {
    //   admin_p_id = 5;
    // } else
    admin_p_id = 1;
    try {
      // Fetch data from the backend
      const response = await fetch(`/api/getAdminData?prompt_id=${admin_p_id}`);
      if (response.ok) {
        adminData = await response.json();
        // console.log("Found admin data for type" + $selectedAnnotationType);
        console.log(
          `Found ${adminData.length} rows in admin data for type: ${$selectedAnnotationType}`
        );
      } else {
        console.error("Failed to fetch admin data");
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
    }
  });

  // let system_prompt = `
  //   You are an assistant specializing in news article text content analysis and annotation.
  //   You will be given text in news articles.

  //   Your task is to determine whether an article contains "hard news."

  //   Based on the information in the provided text and the definition supplied, respond with a single word: either "Yes" or "No" only.

  //   Format your response EXACTLY as follows:
  //   [Yes / No]

  //   Do not add any explanations, comments, or additional information.
  // `;

  const k = 2;
  const EXPRESSION_LIST =
    "Almost No Chance, Highly Unlikely, Chances are Slight, Little Chance, Unlikely, Probably Not, About Even, Better than Even, Likely, Probably, Very Good Chance, Highly Likely, Almost Certain";

  let system_prompt = `
    Provide your ${k} best guesses and the probability that each is correct (0.0 to

    1.0) for the following question. Give ONLY the guesses, probabilities and describe how likely it is

    that your guess is correct as one of the following expressions: ${EXPRESSION_LIST}, and include an explanation only after specifying "Explanation:" in the end. 

    For example:\n\nG1: <first most likely guess, Yes or No answer to the question!>\n\nP1: <the probability between

    0.0 and 1.0 that G1 is correct, without any extra commentary whatsoever; just

    the probability!> ... G${k}: <${k}-th most likely guess, Yes or No answer to the question!>\n\nP${k}: <the probability between 0.0

    and 1.0 that G${k} is correct, without any extra commentary whatsoever; just the

    probability!>\nConfidence: <description of confidence, without any extra

    commentary whatsoever; just a short phrase!>\nExplanation: <include your explanation here.> \n`;

  function splitData(data) {
    const total = data.length;
    const trainSize = Math.floor(total * 0.6);
    const holdoutSize = Math.floor(total * 0.1);

    const trainingSet = data.slice(0, trainSize);
    const holdoutSet = data.slice(trainSize, trainSize + holdoutSize);
    let testSet = data.slice(trainSize + holdoutSize);
    testSet = testSet.slice(0, Math.min(50, testSet.length));

    return { trainingSet, holdoutSet, testSet };
  }

  async function sendPrompt(question) {
    latestProgress.set("pending");
    numAnnotated.set("0");
    console.log("Got the question" + question);
    showPopup = false;
    const startTimestamp = Date.now();
    localStorage.setItem("annotationStartTimestamp", startTimestamp.toString());

    // Retrieve the latest values from Svelte stores
    const annotationTypeValue = get(selectedAnnotationType);
    const userIdValue = get(userId);

    if (!annotationTypeValue || !userIdValue) {
      console.error("Annotation type or user ID is missing.");
      return;
    }

    if (!adminData || adminData.length === 0) {
      console.error("No admin data available for annotation.");
      return;
    }
    const { trainingSet, holdoutSet, testSet } = splitData(adminData);

    try {
      waitingForAnnotation.set(true);
      pendingPrompt.set({
        text: question,
        showDetails: true,
      });

      // trigger fine-tuning
      const response = await fetch("/api/toOpenAI", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainingSet,
          // validationSet,
          testSet,
          question,
          system_prompt,
          $prompts,
          prompt_type: annotationTypeValue,
          writer_id: userIdValue,
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        const newPromptId = responseData.prompt_id;
        console.log(
          "Data sent to OpenAI successfully, new prompt ID:",
          newPromptId
        );

        // Refresh past prompts after a successful request
        await fetchPastPrompts();

        // latestProgress.set("annotation completed");
        // waitingForAnnotation.set(false);
        // pendingPrompt.set(null);
      } else {
        console.error("Failed to send data to OpenAI");
        waitingForAnnotation.set(false);
        latestProgress.set("error sending data to OpenAI");
        numAnnotated.set("0");
      }
    } catch (error) {
      console.error("Error sending data to OpenAI:", error);
      waitingForAnnotation.set(false);
      latestProgress.set("error sending data to OpenAI");
      numAnnotated.set("0");
    }
  }

  onMount(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/toOpenAI");
        if (response.ok) {
          const { progress } = await response.json();
          latestProgress.set(progress);
          console.log("UPDATED LATEST PROGRESS to:", get(latestProgress));
          console.log("waiting for annotation??", get(waitingForAnnotation));
          console.log("current pending prompt:" + get(pendingPrompt));

          if (get(latestProgress) === "annotating" && !numAnnotatedPolling) {
            startNumAnnotatedPolling();
          }
        } else {
          console.error("Failed to fetch progress");
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
      }
    }, 10000); // Poll every 10 seconds

    // return () => clearInterval(interval); // Cleanup on component unmount

    // Store interval ID for numAnnotated polling
    let numAnnotatedPolling = null;

    function startNumAnnotatedPolling() {
      if (numAnnotatedPolling) return; // Avoid duplicate polling

      console.log("Starting numAnnotated polling...");
      numAnnotatedPolling = setInterval(async () => {
        try {
          const response = await fetch("/api/toOpenAI");
          if (response.ok) {
            const { count } = await response.json();
            numAnnotated.set(count);
            console.log("UPDATED NUM ANNOTATED to:", get(numAnnotated));
          } else {
            console.error("Failed to fetch numAnnotated");
          }

          // Stop polling if annotation process is completed
          if (get(latestProgress) !== "annotating") {
            stopNumAnnotatedPolling();
          }
        } catch (error) {
          console.error("Error fetching numAnnotated:", error);
        }
      }, 3000); // Poll every 3 seconds
    }

    function stopNumAnnotatedPolling() {
      if (numAnnotatedPolling) {
        clearInterval(numAnnotatedPolling);
        numAnnotatedPolling = null;
        console.log("Stopped numAnnotated polling.");
      }
    }

    onDestroy(() => {
      clearInterval(progressInterval);
      stopNumAnnotatedPolling();
    });
  });

  $: {
    if (
      $latestProgress === "annotation completed" ||
      $latestProgress === "error sending data to OpenAI"
    ) {
      // Annotation is done, so clear the pending prompt and refresh data.
      console.log("CHANGE IN latest to ANNO COMP, or got error");
      waitingForAnnotation.set(false);
      pendingPrompt.set(null);
      fetchPastPrompts();
    }
  }

  //UI Related functions
  function addPromptWindow() {
    const newPrompt = {
      text: ``,
      showDetails: true,
    };
    pendingPrompt.set(newPrompt);
  }

  /**
   * @param {number} index
   */
  function toggleDetails(index) {
    $prompts[index].showDetails = !$prompts[index].showDetails;
  }

  // function manageTimer() {
  //   if ($waitingForAnnotation) {
  //     timeElapsed = 0; // Reset timer at the start
  //     interval = setInterval(() => {
  //       timeElapsed += 1;
  //     }, 1000);
  //   } else {
  //     clearInterval(interval);
  //   }
  // }

  function manageTimer() {
    clearInterval(interval);

    if ($waitingForAnnotation) {
      interval = setInterval(() => {
        const storedTimestamp = localStorage.getItem(
          "annotationStartTimestamp"
        );
        if (storedTimestamp) {
          const elapsedMs = Date.now() - parseInt(storedTimestamp, 10);
          timeElapsed = Math.floor(elapsedMs / 1000);
        } else {
          // If for some reason there's no stored timestamp, just set to 0
          timeElapsed = 0;
        }
      }, 1000);
    }
  }

  function cancelNewPrompt() {
    pendingPrompt.set(null);
  }

  // Watch waitingForAnnotation to start or stop the timer
  $: if ($waitingForAnnotation) {
    manageTimer();
  } else {
    clearInterval(interval);
  }

  // Format time as MM:SS
  $: {
    minutes = Math.floor(timeElapsed / 60);
  }
  $: {
    seconds = timeElapsed % 60;
  }
  $: {
    formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  onDestroy(() => {
    clearInterval(interval);
  });

  function getColor(status) {
    if (
      [
        "waiting for annotation task",
        "annotation completed",
        "fine tuning job validating_files",
        "fine tuning job running",
        "fine tuning job succeeded",
        "annotating",
        "starting",
      ].includes(status)
    ) {
      return "green";
    } else if (["pending", "fine tuning job queued"].includes(status)) {
      return "orange";
    } else if (
      [
        "fine tuning job failed",
        "fine tuning job cancelled",
        "error sending data to OpenAI",
      ].includes(status)
    ) {
      return "red";
    }
    return "inherit";
  }

  function formatTimeSubmitted(time) {
    const date = new Date(time);
    formattedTime = date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
      hour12: false,
    });
    return formattedTime;
  }

  function logout() {
    // selectedAnnotationType.set("");
    userId.set(null);
    userName.set(null);
    prompts.set(null);

    location.href = "../";
  }
</script>

<section class="head">
  <!-- <div style="display:flex; justify-content:space-between">
    <h1 style="margin:0% 0% 0% 0%;">
      <Fa icon={faHouse} /> <span style="color:#5facf2">{$userName}</span>'s
      Prompts
    </h1>
    <button on:click={logout}>Log Out</button>
  </div> -->
  <nav>
    <!-- Logo -->
    <div class="nav-left">
      <!-- <a href="start"> -->
      <a
        href={`../start`}
        style="vertical-align:top; margin:5px 10px 0 0;"
        on:click|preventDefault={() => {
          goto(`/start`);
          setTimeout(() => window.location.reload(), 100);
        }}><Fa icon={faChevronLeft} /></a
      >
      <img src="/imgs/logo.png" alt="AnnotateThis" class="logo" />
      <!-- </a> -->
      <h1 style="vertical-align: middle; margin:5px 0 0 12px;">Home</h1>
    </div>

    <!-- Navigation Links -->
    <!-- <div class="nav-center">
      <a href="/">Home</a>
      <a href="/analysis">Analysis</a>
    </div> -->

    <!-- User -->
    <div class="nav-right">
      <h1 style="margin:0% 15% 0% 0%;">{get(userName)}</h1>
      <img src="/imgs/user-icon.png" alt="User Icon" class="user-icon" />
    </div>
  </nav>
  <!-- <p>
    Selected Annotation Type: <span style="font-weight:bold"
      >{$selectedAnnotationType}</span
    >
  </p> -->
</section>

<section class="top">
  <h2>You have written {$prompts.length} prompts so far!</h2>
  <p>
    View some summary information about your prompts here, and click on the
    options below each prompt to explore more!
  </p>

  <!-- Prompt Cards -->
  <div class="prompt-cards">
    {#each $prompts as prompt, index}
      {#if !prompt.adding}
        <div class="prompt-card">
          <h3>Prompt {index + 1}:</h3>
          <span>{formatTimeSubmitted(prompt.time_submitted)}</span>
          <div class="prediction-row">
            {#if prompt.yesCount !== undefined && prompt.noCount !== undefined}
              <span>
                Predicted <span style="color:#66bb6a">Yes</span>: {prompt.yesPercentage}%,
                <span style="color:#ef5350">No</span>: {prompt.noPercentage}%
              </span>
              <div class="prediction-bar">
                <div
                  class="yes-bar"
                  style="width: {prompt.yesPercentage}%;"
                ></div>
                <div
                  class="no-bar"
                  style="width: {prompt.noPercentage}%;"
                ></div>
              </div>
            {/if}
          </div>
          <div class="prompt-text-wrapper">
            <p class="prompt-text">{prompt.text}</p>
            <div>
              <a
                href={`/buckets?title=${encodeURIComponent(prompt.prompt_id)}&id=${prompt.prompt_id}&idshow=${index + 1}`}
                class="explore-button"
                on:click|preventDefault={() => {
                  goto(
                    `/buckets?title=${encodeURIComponent(prompt.prompt_id)}&id=${prompt.prompt_id}&idshow=${index + 1}`
                  );
                  setTimeout(() => window.location.reload(), 100); // Force refresh after navigation
                }}
              >
                Annotations from prompt {index + 1}
                <Fa icon={faChevronRight} />
              </a>
            </div>

            <div>
              <a
                href={`/stats?title=${encodeURIComponent(prompt.prompt_id)}&id=${prompt.prompt_id}&idshow=${index + 1}`}
                class="explore-button"
                on:click|preventDefault={() => {
                  goto(
                    `/stats?title=${encodeURIComponent(prompt.prompt_id)}&id=${prompt.prompt_id}&idshow=${index + 1}`
                  );
                  setTimeout(() => window.location.reload(), 100);
                }}
              >
                Statistics from prompt {index + 1}
                <Fa icon={faChevronRight} />
              </a>
            </div>
          </div>
        </div>
      {/if}
    {/each}
  </div>
</section>

<section>
  <div style="display:flex; flex-direction:row; justify-content:space-between">
    <button
      on:click={addPromptWindow}
      style="margin: 0% 0% 2% 5%; display: block;">+ New Prompt</button
    >
    <!-- <p
      style="margin: 0% 5% 2% 5%; background-color:#E8F2FE; border-radius: 10px; padding:10px; display: inline-block;"
    >
      Current Progress in AI Annotation: <span
        style="color: {getColor($latestProgress)}; font-weight: bold;"
        >{$latestProgress}
      </span>
    </p> -->
    <div
      style="
    margin: 0% 5% 2% 5%;
    background-color: #e8f2fe;
    border-radius: 10px;
    padding: 10px;
    display: flex;
    align-items: center;
    gap: 15px;
    width: calc(75% - 10px);
  "
    >
      <p style="margin: 0; white-space: nowrap;">
        Current Progress in AI Annotation:
        <span style="color: {getColor($latestProgress)}; font-weight: bold;"
          >{$latestProgress}</span
        >
        &nbsp &nbsp {$numAnnotated}/250 (50 * 5 runs) samples annotated
      </p>
      <div
        style="
      flex-grow: 1;
      background-color: #ddd;
      border-radius: 6px;
      height: 12px;
      overflow: hidden;
    "
      >
        <div
          style="
        width: {($numAnnotated / 250) * 100}%;
        background-color: #66bb6a;
        height: 100%;
      "
        ></div>
      </div>
    </div>
  </div>
  {#if $pendingPrompt}
    <div class="prompt">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="prompt-header"
        on:click={() =>
          ($pendingPrompt.showDetails = !$pendingPrompt.showDetails)}
      >
        <h3>New Prompt</h3>
        {#if $waitingForAnnotation}
          <p style="text-align:right">
            <!-- <span style="color:red; font-weight:bold"
              >Please do not close the window or refresh while annotating.</span
            ><br /> The results will automatically return when annotation is
            finished.<br /> -->
            <!-- AI is annotating data...  -->
            <span>Time elapsed: {formattedTime}</span>
            <br />
            <!-- Latest progress in AI annotation:
            <span style="color: {getColor($latestProgress)}"
              >{$latestProgress}
            </span> -->
          </p>
        {/if}
      </div>
      {#if $pendingPrompt.showDetails}
        <div style="margin: 1% 0% 0% 0%; padding-bottom:2%">
          <textarea
            bind:value={$pendingPrompt.text}
            placeholder="Please enter your new prompt"
            class="prompt-text"
            style="width:100%; height: 12em;"
          />
          <!-- {#if !$waitingForAnnotation}
            <button
              on:click={() => (
                (newAddingPrompt = $pendingPrompt), (showPopup = true)
              )}>Submit and Test</button
            >
          {/if} -->
          <div class="button-group">
            {#if !$waitingForAnnotation}
              <button
                style="background-color:#ccc; color:#000"
                on:click={cancelNewPrompt}>Cancel</button
              >
              <button
                on:click={() => (
                  (newAddingPrompt = $pendingPrompt), (showPopup = true)
                )}
              >
                Submit and Test
              </button>
            {:else}
              <button
                disabled
                style="opacity: 0.5; background-color:#ccc; color:#000"
                >Cancel</button
              >
              <button disabled style="opacity: 0.5;">Submit and Test</button>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if showPopup}
    <div class="popup-overlay">
      <div class="popup-content">
        <h3>Annotation Process</h3>
        <p>
          The annotation process takes approximately 5 minutes to complete.
          Please do not refresh page while annotation is in progress. Click
          "Proceed" to start.
        </p>
        <button on:click={sendPrompt(newAddingPrompt.text)}>Proceed</button>
        <button on:click={() => (showPopup = false)}>Cancel</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .head {
    margin: 1% 5% 1% 5%;
    display: flex-start;
  }

  nav {
    width: 100%;
    padding: 16px 16px 16px 0;
    /* border-bottom: 1px solid #e5e7eb; */
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

  .top {
    margin: 0% 5% 3% 5%;
    display: flex-start;
    background-color: #f5f5f5;
    padding: 1% 3% 1% 3%;
    border-radius: 10px;
  }

  .prompt {
    margin: 0% 5% 3% 5%;
    padding: 1% 5% 1% 5%;
    border-radius: 10px;
    box-shadow: 0px 0px 2px 2px rgb(0 0 0 / 15%);
  }

  .prompt-header {
    display: flex;
    justify-content: space-between;
    cursor: pointer;
  }

  .prompt-details {
    height: 17em;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin: 1% 0% 3% 0%;
  }

  .prompt-text {
    border: 1px solid #ccc;
    border-radius: 10px;
    overflow: scroll;
    padding: 3%;
    /* width: 70%; */
  }

  .metrics {
    background-color: #e8f2fe;
    border-radius: 5px;
    padding: 10%;
  }

  .metrics p {
    margin: 0;
  }

  button {
    background-color: #5facf2;
    color: white;
    border: none;
    padding: 8px 15px;
    cursor: pointer;
    border-radius: 5px;
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

  .popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .popup-content {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .popup-content h3 {
    margin-bottom: 15px;
  }

  .popup-content button {
    margin: 5px;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .popup-content button:first-child {
    background: #5facf2;
    color: #fff;
  }

  .popup-content button:last-child {
    background: #ccc;
    color: #000;
  }

  video {
    border: 2px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .instructions {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-bottom: 1em;
  }
  .navigation-buttons {
    margin-top: 1em;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }
  button {
    margin-right: 0.5em;
    padding: 0.5em 1em;
    font-size: 1em;
  }
  .button-group {
    display: flex;
    justify-content: space-between;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .prompt-cards {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding: 16px 0;
  }

  .prompt-card {
    flex: 0 0 auto;
    background-color: #e8f2fe;
    padding: 16px;
    border-radius: 10px;
    min-width: 200px;
    max-width: 450px;
    box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.1);
    cursor: pointer;
  }

  .prompt-card p {
    background-color: #fff;
    padding: 10px;
    border-radius: 5px;
    margin-top: 8px;
    box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.1);
  }

  .prediction-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 8px 0;
  }

  .prediction-bar {
    display: flex;
    height: 8px;
    width: 120px;
    border-radius: 5px;
    overflow: hidden;
  }

  /* accessibility for red green color blind people?? */
  .yes-bar {
    background-color: #66bb6a;
    height: 100%;
  }

  .no-bar {
    background-color: #ef5350;
    height: 100%;
  }
</style>
