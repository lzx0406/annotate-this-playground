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

<slot />
