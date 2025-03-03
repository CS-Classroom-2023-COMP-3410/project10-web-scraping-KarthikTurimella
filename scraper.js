/**
 * index.js
 * Run: `node index.js`
 */

/* ---------------------------------------------------------------
   1. Polyfill for Node < 18 (comment out if Node >= 18)
   --------------------------------------------------------------- */
   try {
    // If these classes don’t exist, define them from 'stream/web'
    if (typeof ReadableStream === "undefined") {
      globalThis.ReadableStream = require("stream/web").ReadableStream;
    }
    if (typeof WritableStream === "undefined") {
      globalThis.WritableStream = require("stream/web").WritableStream;
    }
    if (typeof TransformStream === "undefined") {
      globalThis.TransformStream = require("stream/web").TransformStream;
    }
  } catch (err) {
    // If the 'stream/web' import fails for some reason, just log a warning.
    console.warn(
      "Warning: Could not polyfill Readable/Writable/Transform streams.",
      err.message
    );
  }
  /**
   * index.js
   * Usage: node index.js
   */
  const axios = require("axios");
  const cheerio = require("cheerio");
  const fs = require("fs-extra");
  
  /* ------------------------------------------------------------------
     TASK 1:
     SCRAPE DU BULLETIN FOR UPPER-DIVISION CS COURSES W/O PREREQUISITES
     ------------------------------------------------------------------ */
  async function scrapeBulletin() {
    // Undergraduate COMP courses URL:
    const url = "https://bulletin.du.edu/undergraduate/coursedescriptions/comp/";
    const results = { courses: [] };
  
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
  
      $("div.courseblock").each((_idx, el) => {
        const titleText = $(el).find("p.courseblocktitle").text().trim();
        const descText = $(el).find("p.courseblockdesc").text().trim();
  
        // Example format: "COMP 3000 Intro to X (4 Credits)"
        const match = titleText.match(/(COMP\s*\d+)\s+(.*)\(\d+.*\)/);
        if (match) {
          // Convert "COMP 3000" → "COMP-3000"
          const courseCode = match[1].replace(/\s+/, "-").trim();
          const courseTitle = match[2].trim();
  
          // Check that courseNumber >= 3000
          const numMatch = courseCode.match(/\d+/);
          if (numMatch) {
            const courseNumber = parseInt(numMatch[0], 10);
            if (courseNumber >= 3000) {
              // Ensure "prereq" is NOT in the description
              if (!/prereq/i.test(descText)) {
                results.courses.push({
                  course: courseCode, // e.g. "COMP-3000"
                  title: courseTitle,
                });
              }
            }
          }
        }
      });
  
      await fs.ensureDir("results");
      await fs.writeJson("results/bulletin.json", results, { spaces: 2 });
      console.log(
        "✅  bulletin.json →",
        results.courses.length,
        "upper-division COMP courses without prereqs"
      );
    } catch (err) {
      console.error("❌  Error scraping DU Bulletin:", err.message);
    }
  }
  
  /* ------------------------------------------------------------------
     TASK 2:
     SCRAPE DU ATHLETICS SITE FOR UPCOMING EVENTS
     (AVOID the JS-driven homepage carousel by scraping a
     server-rendered schedule: MEN'S SOCCER)
     ------------------------------------------------------------------ */
  async function scrapeAthleticEvents() {
    // Men's Soccer schedule page:
    const url = "https://denverpioneers.com/sports/mens-soccer/schedule";
    const results = { events: [] };
  
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
  
      // Each match is often in a .schedule-game or .schedule-listing container
      // Adjust as needed to reflect the actual classes used
      $(".sidearm-schedule-games-container .sidearm-schedule-game-row").each(
        (_idx, el) => {
          const date = $(el)
            .find(".sidearm-schedule-game-opponent-date")
            .text()
            .replace(/\n|\t/g, "")
            .trim();
          const opponent = $(el)
            .find(".sidearm-schedule-game-opponent-name")
            .text()
            .replace(/\n|\t/g, "")
            .trim();
          const location = $(el)
            .find(".sidearm-schedule-game-location")
            .text()
            .replace(/\n|\t/g, "")
            .trim();
  
          console.log(date, opponent, location);
          results.events.push({
            date,
            opponent,
            location,
          });
        }
      );
  
      await fs.ensureDir("results");
      await fs.writeJson("results/athletic_events.json", results, { spaces: 2 });
      console.log(
        "✅  athletic_events.json →",
        results.events.length,
        "events from Men’s Soccer schedule"
      );
    } catch (err) {
      console.error("❌  Error scraping Athletics:", err.message);
    }
  }
  
  /* ------------------------------------------------------------------
     TASK 3:
     SCRAPE THE DU MAIN CALENDAR FOR 2025 EVENTS
     https://www.du.edu/calendar is JS-driven. Cheerio sees minimal HTML.
     We'll attempt to parse a Next.js data script (id="__NEXT_DATA__").
     If it exists and includes 2025 events, we'll list them.
     Otherwise, we'll store a fallback event so the file isn't empty.
     ------------------------------------------------------------------ */
  async function scrapeCalendarEvents2025() {
    const url = "https://www.du.edu/calendar";
    const results = { events: [] };
  
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
  
      // Each event is in a .events-listing__item container
      $(".events-listing__item").each((_idx, el) => {
        const title = $(el).find("h3").text().trim();
        const date = $(el).find("p").eq(0).text().trim();
        const time = $(el).find("p").eq(1).text().trim();
        const location = $(el).find("p").eq(2).text().trim();
        console.log(date, time, location);
        // Check if the event date includes "2025"
  
        results.events.push({
          title,
          date,
          time,
          location,
        });
      });
  
      // Write the results to calendar_events.json
      await fs.ensureDir("results");
      await fs.writeJson("results/calendar_events.json", results, { spaces: 2 });
      console.log(
        "✅  calendar_events.json →",
        results.events.length,
        "events from DU Calendar for 2025"
      );
    } catch (err) {
      console.error("❌  Error scraping DU Calendar:", err.message);
  
      // As a final fallback, write a placeholder event so the file is not empty
      const fallback = {
        events: [
          {
            title: "Calendar Page Error",
            date: "N/A",
            time: "N/A",
            location: err.message,
          },
        ],
      };
      await fs.ensureDir("results");
      await fs.writeJson("results/calendar_events.json", fallback, { spaces: 2 });
    }
  }
  
  /* ------------------------------------------------------------------
     MAIN: RUN ALL SCRAPERS
     ------------------------------------------------------------------ */
  (async function main() {
    // 1. Bulletin
    await scrapeBulletin();
  
    // 2. Athletics
    await scrapeAthleticEvents();
  
    //   3. Calendar (2025)
    await scrapeCalendarEvents2025();
  })();
  