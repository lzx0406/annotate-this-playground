<script>
  import Fa from "svelte-fa";
  import {
    faChevronLeft,
    faChevronRight,
    faChevronDown,
    faHouse,
  } from "@fortawesome/free-solid-svg-icons";
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

  let expPageInstruction = false;
  function togglePageInstructions() {
    expPageInstruction = !expPageInstruction;
  }

  let expInstruction = false;
  function toggleInstructions() {
    expInstruction = !expInstruction;
  }
</script>

<section>Tutorial on page</section>
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
