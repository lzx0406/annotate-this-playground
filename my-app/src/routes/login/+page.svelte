<script>
  import { goto } from "$app/navigation";
  import { userId, userName } from "$lib/stores";
  let email = "";
  let password = "";
  let errorMessage = "";

  /**
   * @param {{ preventDefault: () => void; }} event
   */
  async function login(event) {
    event.preventDefault();

    const loginData = { email, password };

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });

      if (response.ok) {
        const data = await response.json();
        // console.log("Getting the DATAAA!!");
        // console.log(data);

        // Set the user ID in the store
        userId.set(data.userId);
        userName.set(data.userName);
        // Redirect to the home page or a protected route
        goto("/prompts");
      } else {
        const errorData = await response.json();
        errorMessage = errorData.message || "Login failed. Please try again.";
      }
    } catch (error) {
      console.error("Error:", error);
      errorMessage = "Something went wrong. Please try again later.";
    }
  }
</script>

<main>
  <h1 class="top">Log In</h1>
  <form on:submit={login}>
    <div>
      <label for="email">Email:</label>
      <input type="email" id="email" bind:value={email} required />
    </div>
    <div>
      <label for="password">Password:</label>
      <input type="password" id="password" bind:value={password} required />
    </div>
    {#if errorMessage}
      <p style="color: red;">{errorMessage}</p>
    {/if}
    <button type="submit">Log In</button>
  </form>
</main>

<style>
  .top {
    margin: 0% 5% 3% 5%;
    display: flex-start;
  }

  form {
    display: flex;
    flex-direction: column;
    max-width: 300px;
    margin: auto;
  }

  label,
  input {
    margin-bottom: 10px;
  }

  button {
    background-color: #5facf2;
    color: white;
    border: none;
    padding: 8px 15px;
    cursor: pointer;
    border-radius: 5px;
  }
</style>
