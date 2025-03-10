<script>
  import { goto } from "$app/navigation";
  let email = "";
  let username = "";
  let password = "";
  let role = "";
  let confirmPassword = "";
  let errorMessage = "";
  let successMessage = "";

  /**
   * @param {{ preventDefault: () => void; }} event
   */
  async function signup(event) {
    event.preventDefault();

    if (password !== confirmPassword) {
      errorMessage = "Passwords do not match. Please try again.";
      return;
    }

    const signupData = { username, email, role, password };

    try {
      const response = await fetch("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupData),
      });

      if (response.ok) {
        successMessage =
          "Account created successfully! Redirecting to login...";
        setTimeout(() => {
          goto("/login");
        }, 2000);
      } else {
        const errorData = await response.json();
        errorMessage = errorData.message || "Sign up failed. Please try again.";
      }
    } catch (error) {
      console.error("Error:", error);
      errorMessage = "Something went wrong. Please try again later.";
    }
  }
</script>

<main>
  <h1 class="top">Sign Up</h1>
  <form on:submit={signup}>
    <div>
      <label for="username">Name:</label>
      <input type="text" id="username" bind:value={username} required />
    </div>
    <div>
      <label for="email">Email:</label>
      <input type="email" id="email" bind:value={email} required />
    </div>
    <div>
      <label for="role">Role:</label>
      <select id="role" bind:value={role} required>
        <option value="academic">Academic</option>
        <option value="professor">Professor</option>
        <option value="student">Student</option>
        <option value="researcher">Researcher</option>
      </select>
    </div>
    <div>
      <label for="password">Password:</label>
      <input type="password" id="password" bind:value={password} required />
    </div>
    <div>
      <label for="confirmPassword">Confirm Password:</label>
      <input
        type="password"
        id="confirmPassword"
        bind:value={confirmPassword}
        required
      />
    </div>
    {#if errorMessage}
      <p style="color: red;">{errorMessage}</p>
    {/if}
    {#if successMessage}
      <p style="color: green;">{successMessage}</p>
    {/if}
    <button type="submit">Sign Up</button>
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

  p {
    margin-top: 10px;
  }
</style>
