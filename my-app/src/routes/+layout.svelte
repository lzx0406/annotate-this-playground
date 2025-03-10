<script context="module">
  import { redirect } from "@sveltejs/kit";

  // @ts-ignore
  export async function load({ url }) {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("authToken");

      // If the user is authenticated and visits the root, login, or signup pages, redirect to the main app page
      if (
        token &&
        (url.pathname === "/" ||
          url.pathname === "/login" ||
          url.pathname === "/signup")
      ) {
        throw redirect(307, "/prompts");
      }
    }
  }
</script>

<script>
  // import { writable } from "svelte/store";
  // import { setContext } from "svelte";

  // // Create a writable store for prompts
  // const prompts = writable([]);

  // // Initial prompts for testing
  // const initialPrompts = [
  //   {
  //     id: 3,
  //     title: "Prompt 3",
  //     text: `Please determine whether the following comment expresses a concern for wildlife. To be considered a
  //         concern for wildlife, the comment must focus on issues related to the well-being, safety, or conservation
  //         of animals in their natural habitats. Please first justify your decision by identifying specific phrases or
  //         concepts related to wildlife concern, and then conclude with either: "True: This comment expresses a concern
  //         for wildlife" or "False: This comment does not express a concern for wildlife."`,
  //     date: "09/18/2024",
  //     accuracy: "85%",
  //     f1Score: "0.78",
  //     precision: "0.80",
  //     recall: "0.76",
  //     showDetails: false,
  //     showErrors: false,
  //     adding: false,
  //   },
  //   {
  //     id: 2,
  //     title: "Prompt 2",
  //     text: `Please evaluate the following comment and decide whether it contains a concern for wildlife. A concern
  //         for wildlife should include mentions of threats to animal populations, the impact of human activities on wildlife,
  //         or appeals for wildlife protection. Please explain the reasoning behind your decision and then conclude with either:
  //         "True: This comment contains concern for wildlife" or "False: This comment does not contain concern for wildlife."`,
  //     date: "09/17/2024",
  //     accuracy: "90%",
  //     f1Score: "0.85",
  //     precision: "0.87",
  //     recall: "0.83",
  //     showDetails: false,
  //     showErrors: false,
  //     adding: false,
  //   },
  //   {
  //     id: 1,
  //     title: "Prompt 1",
  //     text: `Analyze the following comment and decide if it demonstrates concern for wildlife. For a comment to demonstrate
  //         concern for wildlife, it should discuss the protection, conservation, or welfare of animals and their habitats. Please
  //         provide justification for your answer based on relevant keywords or topics in the comment, and conclude with: "True: This
  //         comment shows concern for wildlife" or "False: This comment does not show concern for wildlife."`,
  //     date: "09/15/2024",
  //     accuracy: "88%",
  //     f1Score: "0.82",
  //     precision: "0.84",
  //     recall: "0.80",
  //     showDetails: false,
  //     showErrors: false,
  //     adding: false,
  //   },
  // ];
  // // @ts-ignore
  // prompts.set(initialPrompts);
  // // Use setContext to make the store available to child components
  // setContext("prompts", prompts);
</script>

<slot />
