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
  } from "@fortawesome/free-solid-svg-icons";

  import {
    selectedAnnotationType,
    userId,
    userName,
    prompts,
  } from "$lib/stores";

  const query = $page.url.searchParams;
  const title = query.get("title");
  const id = query.get("id");
  const idshow = query.get("idshow");
  let textP, timeP;

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

  onMount(() => {
    console.log("MOUNTINGGGGGGG");
    console.log("Current prompts:", $prompts);
    [textP, timeP] = getPromptInfo(id);
    console.log(textP);
  });
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
        Statistics
      </h1>
    </div>

    <!-- User -->
    <div class="nav-right">
      <h1 style="margin:0% 15% 0% 0%;">{get(userName)}</h1>
      <img src="/imgs/user-icon.png" alt="User Icon" class="user-icon" />
    </div>
  </nav>
</section>

<section>
  <div class="top">
    <p>
      <span style="font-weight:bold">Prompt {idshow} </span>
      ({formatTimeSubmitted(timeP)})
    </p>
    <p>{textP}</p>
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
    padding: 16px 16px 16px 0;
    /* border-bottom: 1px solid #e5e7eb; */
    display: flex;
    align-items: center;
    justify-content: space-between;
    /* font-size: 18px; */
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

  /* link related css */

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
