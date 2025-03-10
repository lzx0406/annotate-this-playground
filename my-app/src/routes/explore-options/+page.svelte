<script>
  // @ts-nocheck

  import { writable } from "svelte/store";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
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
</script>

<section class="head">
  <nav>
    <!-- Logo -->
    <div class="nav-left">
      <img src="/imgs/logo.png" alt="AnnotateThis" class="logo" />
      <h1 style="vertical-align: middle; margin:3% 0% 0% 8%;">
        Concept Exploration
      </h1>
    </div>

    <!-- User -->
    <div class="nav-right">
      <h1 style="margin:0% 20% 0% 0%;">{get(userName)}</h1>
      <img src="/imgs/user-icon.png" alt="User Icon" class="user-icon" />
    </div>
  </nav>
</section>

<section>
  <div class="container">
    <div class="button-group">
      <a href={`/buckets?title=${title}&id=${id}&idshow=${idshow}`}
        >Go to Buckets to inspect results based on uncertainty buckets</a
      >
      <a href="/tutorial-page"
        >Go to explore different outputs from model perturbations</a
      >
      <a href="/tutorial-prompt"
        >Go to explore different outputs from model perturbations</a
      >
    </div>
  </div>
</section>

<style>
  .head {
    margin: 1% 5% 1% 5%;
    display: flex-start;
  }

  nav {
    width: 100%;
    padding: 16px;
    /* border-bottom: 1px solid #e5e7eb; */
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 18px;
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

  .container {
    height: 80vh;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .button-group {
    display: flex;
    flex-direction: column;
    gap: 20px; /* Space between buttons */
  }

  /* General button style */
  .button-group a {
    display: block;
    text-decoration: none;
    font-size: 20px;
    font-weight: bold;
    padding: 15px 30px;
    border-radius: 9999px; /* Fully rounded */
    text-align: center;
    transition: all 0.3s ease;
    border: 2px solid #7eb7f5;
    color: #3498db;
    background-color: transparent;
  }

  .button-group a:hover {
    background-color: #7eb7f5;
    color: white;
  }

  /* First button as filled by default */
  .button-primary {
    background-color: #7eb7f5;
    color: white;
    border: none;
  }

  .button-primary:hover {
    background-color: #5ea0ec;
  }
</style>
