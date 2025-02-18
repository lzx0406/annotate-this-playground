<script>
  import { goto } from "$app/navigation";
  import { selectedAnnotationType } from "$lib/stores";
  import { get } from "svelte/store";

  let errorMessage = "";

  /**
   * Sets the annotation type.
   * @param {string} type
   */
  function setAnnotation(type) {
    selectedAnnotationType.set(type);
    errorMessage = "";
  }

  /**
   * @param {string | URL} path
   */
  function navigateTo(path) {
    const annotationType = get(selectedAnnotationType);
    selectedAnnotationType.set("news");
    console.log("GET the TYPEEEE" + annotationType);
    goto(path);
    // if (annotationType) {
    //   goto(path);
    // } else {
    //   errorMessage = "Please select an annotation type before proceeding.";
    // }
  }
</script>

<main>
  <h1>Welcome to the AI Data Annotation Application</h1>

  <!-- <div class="annotation-type">
    <label>
      <input
        type="radio"
        name="annotationType"
        value="concern wildlife"
        on:change={() => setAnnotation("concern wildlife")}
      />
      Annotate for Concern for Wildlife
    </label>
    <label>
      <input
        type="radio"
        name="annotationType"
        value="call to action"
        on:change={() => setAnnotation("call to action")}
      />
      Annotate for Call to Action
    </label>
  </div> -->

  <!-- {#if errorMessage} -->
  <p class="error-message">{errorMessage}</p>
  <!-- {/if} -->

  <div class="actions">
    <button on:click={() => navigateTo("/login")}>Log In</button>
    <button on:click={() => navigateTo("/signup")}>Sign Up</button>
  </div>

  <p style="margin:10% 20% 0% 20%">
    This application helps you train an AI to annotate your dataset by creating
    prompts that instruct the AI on how to label your data on news articles. We
    will be annotating on whether a news article from People magazine is hard
    news or soft news.<br />
  </p>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
  }

  .annotation-type {
    margin-top: 40px;
    font-size: larger;
  }

  .annotation-type label {
    margin-right: 15px;
    cursor: pointer;
  }

  .actions {
    margin-top: 40px;
  }

  button {
    background-color: #5facf2;
    color: white;
    border: none;
    padding: 8px 15px;
    cursor: pointer;
    border-radius: 5px;
    margin: 1em;
    font-size: larger;
  }

  .error-message {
    color: red;
  }
</style>
