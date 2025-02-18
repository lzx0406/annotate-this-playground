<script>
  // @ts-nocheck

  import { writable } from "svelte/store";
  import { get } from "svelte/store";
  import { setContext } from "svelte";
  import { onMount, onDestroy } from "svelte";

  import fs from "fs/promises"; // For writing JSONL files

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
  } from "$lib/stores";

  let promptList = [];
  let prompt_id, text, prompt_type, time_submitted, metrics;
  let adminData, admin_p_id;
  let timeElapsed = 0;
  let minutes, seconds, formattedTime;
  let interval;
  console.log("GETTT waiting for annotation:" + $waitingForAnnotation);
  console.log("GETTT Latest:" + $latestProgress);

  let showPopup = false;
  let newAddingPrompt;

  onMount(() => {
    if (!get(userId) || !get(userName)) {
      logout();
    }
  });

  // Fetch past prompts for the logged-in user on component mount
  onMount(() => {
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
      console.log("AFTER REFRESH NOT still annotating");
    }
  });

  onMount(() => {
    const storedTimestamp = localStorage.getItem("annotationStartTimestamp");
    if (storedTimestamp && $waitingForAnnotation) {
      manageTimer();
    }
  });

  // Backend function to handle fetching prompts with metrics
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

        // Process each prompt to ensure metrics are available
        const updatedPrompts = data.map((prompt) => {
          // Parse the metrics field if it is stored as JSON
          if (typeof prompt.metrics === "string") {
            try {
              prompt.metrics = JSON.parse(prompt.metrics);
            } catch (error) {
              console.error("Error parsing metrics JSON:", error);
            }
          }
          return prompt;
        });

        // Update the prompts store with the updated data containing metrics
        prompts.set(updatedPrompts);

        console.log("Updated prompts with metrics:", updatedPrompts);
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

  let system_prompt = `
    You are an assistant specializing in news article text content analysis and annotation.
    You will be given text in news articles.

    Your task is to determine whether an article contains "hard news."

    Based on the information in the provided text and the definition supplied, respond with a single word: either "Yes" or "No" only.

    Format your response EXACTLY as follows:
    [Yes / No]

    Do not add any explanations, comments, or additional information.
  `;

  function splitData(data) {
    const total = data.length;
    const trainSize = Math.floor(total * 0.6);
    const holdoutSize = Math.floor(total * 0.1);

    const trainingSet = data.slice(0, trainSize);
    const holdoutSet = data.slice(trainSize, trainSize + holdoutSize);
    const testSet = data.slice(trainSize + holdoutSize);

    return { trainingSet, holdoutSet, testSet };
  }

  async function sendPrompt(question) {
    latestProgress.set("pending");
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
      }
    } catch (error) {
      console.error("Error sending data to OpenAI:", error);
      waitingForAnnotation.set(false);
      latestProgress.set("error sending data to OpenAI");
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
        } else {
          console.error("Failed to fetch progress");
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval); // Cleanup on component unmount
  });

  $: {
    if ($latestProgress === "annotation completed") {
      // Annotation is done, so clear the pending prompt and refresh data.
      console.log("CHANGE IN latest to ANNO COMP");
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

  let expPageInstruction = false;
  function togglePageInstructions() {
    expPageInstruction = !expPageInstruction;
  }

  let expInstruction = false;
  function toggleInstructions() {
    expInstruction = !expInstruction;
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

  // Instruction part
  let currentStep = 0;

  const steps = [
    {
      text: `First, hit the <span style="font-weight:bold;">View Instructions on How to Write Prompts</span> 
        to learn a bit about developing a prompt and how your prompt will be passed to the AI.`,
      img: "/videos/rec1.gif",
    },
    {
      text: `Hit the <span style="font-weight:bold;">+ New Prompt</span> button to start a new prompt 
        that will annotate your data. Fill in a text prompt and hit <span style="font-weight:bold;">Submit and Test</span>. 
        This sends the prompt to the AI, and annotates the statements (e.g., news articles in People magazine), and may take longer 
        than 30 minutes. Feel free to work on other tasks or grab a coffee :)`,
      img: "/videos/rec2.gif",
    },
    {
      text: `Please don't close the window, but you are free to navigate away from the site and carry on with other work on your computer. </br>
      If the New Prompt window does not persist, please refer to the <span style="font-weight:bold;">Current Progress in AI Annotation</span> for the state of the annotation task. The results will automatically return when annotation is finished.`,
    },
    {
      text: `Once the process is complete, you can click on the prompt to view the results of your prompt's ability to annotate the statements. 
      We have included recall, and accuracy. This compares the performance of your prompt with the manually (crowdsourced) annotated/classified statements.`,
      img: "/videos/rec3.gif",
    },
    {
      text: `It is possible to learn about the specific examples that the AI you trained got right and wrong by pressing the <span style="font-weight:bold;">"error examples"</span> link. 
      This brings up a spreadsheet, which contains the following columns:</br>
      <span style="font-weight:bold;">Article URL</span>: If you click it you will be taken to the news article being annotated. </br>
      <span style="font-weight:bold;">Text</span>: The content text of the news article.</br>
      <span style="font-weight:bold;">Predicted Value</span>: The value predicted by the AI.</br>
      <span style="font-weight:bold;">True Value</span>: The value assigned by the human annotators.</br>
      You can also use the filters under <span style="font-weight:bold;">"Filter Examples"</span> to view only "Yes" or "No" values by AI or humans, or view only incorrect predictions.`,
      img: "/videos/rec4.gif",
    },
    {
      text: `If you encounter any technical difficulties or have any questions, please contact developer at zexuanli@umich.edu. Thank you!`,
    },
  ];

  function nextStep() {
    if (currentStep < steps.length - 1) currentStep++;
  }

  function previousStep() {
    if (currentStep > 0) currentStep--;
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
  <div style="display:flex; justify-content:space-between">
    <h1 style="margin:0% 0% 0% 0%;">
      <Fa icon={faHouse} /> <span style="color:#5facf2">{$userName}</span>'s
      Prompts
    </h1>
    <!-- <button on:click={() => (location.href = "../")}>Log Out</button> -->
    <button on:click={logout}>Log Out</button>
  </div>
  <p>
    Selected Annotation Type: <span style="font-weight:bold"
      >{$selectedAnnotationType}</span
    >
  </p>
</section>

<section>
  <div class="top">
    <h3>Instructions</h3>
    <p>
      You are training an AI to annotate your dataset by creating prompts that
      instruct the AI on how to label your data. Write clear and specific
      prompts, asking the AI to justify its decisions, and refine them based on
      feedback to improve accuracy. Click on the <span style="font-weight:bold"
        >View Instructions</span
      > below for more details on how to use this page, or construct your prompt.
    </p>
    <p>
      To get started click the <span style="font-weight:bold">+ New Prompt</span
      >
      button above. After you have entered a prompt you will see how well this prompt
      was able to instruct the AI to label your data. You will also be able to explore
      examples that the AI predicted correctly and incorrectly. Please use this feedback
      to improve your prompt. Click the
      <span style="font-weight:bold">+ New Prompt</span> button above again to enter
      a new prompt. In total we would like you to enter 10 prompts.
    </p>

    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="prompt-header" on:click={togglePageInstructions}>
      {#if expPageInstruction}
        <h3 style="color: #5facf2">
          <Fa icon={faChevronDown} /> &nbsp; Instructions on How to Use this Page
        </h3>
      {:else}
        <h3 style="color: #5facf2">
          <Fa icon={faChevronRight} /> &nbsp; View Instructions on How to Use this
          Page
        </h3>
      {/if}
    </div>

    {#if expPageInstruction}
      <div class="instructions">
        <p
          style="background-color: rgba(255, 165, 0, 0.3); padding:0.5em; border-radius:5px; font-size:large"
        >
          {@html steps[currentStep].text}
        </p>
        {#if steps[currentStep].img}
          <img
            src={steps[currentStep].img}
            style="width:60%;"
            alt={`Step ${currentStep + 1}`}
          />
        {/if}

        <div class="navigation-buttons">
          <button on:click={previousStep} disabled={currentStep === 0}
            ><Fa icon={faChevronLeft} /> Previous</button
          >
          <div style="font-weight: bold; margin: 0em 1em 0em 1em">
            Step {currentStep + 1} / {steps.length}
          </div>
          <button
            on:click={nextStep}
            disabled={currentStep === steps.length - 1}
            >Next <Fa icon={faChevronRight} /></button
          >
        </div>
      </div>
    {/if}

    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="prompt-header" on:click={() => toggleInstructions()}>
      {#if expInstruction}
        <h3 style="margin-top:0; margin-bottom:1%; color: #5facf2">
          <Fa icon={faChevronDown} /> &nbsp; Instructions on How to Write Prompts
        </h3>
      {:else}
        <h3 style="margin-top:0; margin-bottom:1%; color: #5facf2">
          <Fa icon={faChevronRight} /> &nbsp; View Instructions on How to Write Prompts
        </h3>
      {/if}
    </div>

    {#if expInstruction}
      <p>
        You are training an AI to annotate your dataset. To start, you need to
        prompt this AI with a set of instructions. You can also refine your
        prompts based on the AIs performance.
      </p>
      <!-- <p>Let's get started!</p> -->
      <p>
        For example, let's say you are asking the AI to identify whether a
        social media comment is about summer vacations or not. You may write
        something like the prompt below:
      </p>
      <p
        style="margin-left:30px; margin-right:30px; background-color:#ece2f0; border-radius:5px"
      >
        <tt style="font-size:large">
          Please determine whether the following post is about a summer
          vacation. To be about a summer vacation it must both be about a
          vacation and must take place in the summertime.
        </tt>
      </p>
      <p>
        These instructions should be direct and simple. AI models are designed
        to respond in specific ways (e.g., polite and informative), but you can
        tailor their responses by providing clear instructions in your prompts.
        For example, you can ask them to focus on specific aspects of a topic or
        provide evidence for their claims. Here is a guide for writing effective
        prompts:<br />
        <a
          href="https://midas.umich.edu/research/research-resources/generative-ai-hub/users-guide/effective-prompting/"
          >https://midas.umich.edu/research/research-resources/generative-ai-hub/users-guide/effective-prompting/</a
        ><br />
      </p>
      <p style="font-weight:bold">
        [IMPORTANT] The prompt the AI sees is the following, your prompt would
        be appended to the prompt: <br />
      </p>
      <p
        style="margin-left:30px; margin-right:30px; background-color:#ece2f0; border-radius:5px"
      >
        <tt style="font-size:large">
          You are an assistant specializing in news article text content
          analysis and annotation. You will be given text in news articles. Your
          task is to determine whether an article contains "hard news." Based on
          the information in the provided text and the definition supplied,
          respond with a single word: either "Yes" or "No" only. Format your
          response EXACTLY as follows: [Yes / No] Do not add any explanations,
          comments, or additional information. <span style="font-weight:bold"
            >&lt;YOUR PROMPT WILL BE APPENDED HERE&gt;</span
          ></tt
        >
      </p>
    {/if}
  </div>
</section>

<section>
  <button
    on:click={addPromptWindow}
    style="margin: 0% 0% 2% 5%; display: block;">+ New Prompt</button
  >
  <p
    style="margin: 0% 5% 2% 5%; background-color:#E8F2FE; border-radius: 10px; padding:10px; display: inline-block;"
  >
    Current Progress in AI Annotation: <span
      style="color: {getColor($latestProgress)}; font-weight: bold;"
      >{$latestProgress}
    </span>
  </p>
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
        <div style="margin: 1% 0% 3% 0%; padding-bottom:2%">
          <textarea
            bind:value={$pendingPrompt.text}
            placeholder="Please enter your new prompt"
            class="prompt-text"
            style="width:100%; height: 17em;"
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
          The annotation process takes approximately more than 30 minutes to
          complete. Please do not refresh page while annotation is in progress.
          Click "Proceed" to start.
        </p>
        <button on:click={sendPrompt(newAddingPrompt.text)}>Proceed</button>
        <button on:click={() => (showPopup = false)}>Cancel</button>
      </div>
    </div>
  {/if}

  {#each $prompts as prompt, index}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    {#if !prompt.adding}
      <div class="prompt">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div class="prompt-header" on:click={() => toggleDetails(index)}>
          {#if prompt.showDetails}
            <h3>
              <!-- <Fa icon={faChevronDown} /> &nbsp; Prompt {prompt.prompt_id} -->
              <Fa icon={faChevronDown} /> &nbsp; Prompt {index + 1}
            </h3>
          {:else}
            <h3>
              <Fa icon={faChevronRight} /> &nbsp; Prompt {index + 1}
            </h3>
          {/if}
          <p>{formatTimeSubmitted(prompt.time_submitted)}</p>
        </div>

        {#if prompt.showDetails}
          <div class="prompt-details">
            <div class="prompt-text">{prompt.text}</div>
            <div
              style="width: 25%; display: flex; flex-direction:column; justify-content: space-between;"
            >
              <div class="metrics">
                <!-- Conditionally display metrics if they exist -->
                {#if prompt.metrics}
                  <p><strong>Accuracy:</strong> {prompt.metrics.accuracy}</p>
                  <p><strong>Precision:</strong> {prompt.metrics.precision}</p>
                  <p><strong>Recall:</strong> {prompt.metrics.recall}</p>
                {:else}
                  <p>Loading metrics...</p>
                {/if}
              </div>
              <a
                href={`/examples?title=${encodeURIComponent(prompt.prompt_id)}&id=${prompt.prompt_id}&idshow=${index + 1}`}
                style="text-align:right;"
                >Error Examples <Fa icon={faChevronRight} /></a
              >
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/each}
</section>

<style>
  .head {
    margin: 3% 5% 0% 5%;
    display: flex-start;
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
    width: 70%;
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
</style>
