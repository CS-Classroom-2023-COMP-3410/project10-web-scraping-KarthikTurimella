/**
 * index.js
 * Run: `node index.js`
 */

/* ---------------------------------------------------------------
   1. Polyfill for Node < 18 (comment out if Node >= 18)
   --------------------------------------------------------------- */
   try {
    // If these classes don’t exist, define them from 'stream/web'
    if (typeof ReadableStream === 'undefined') {
      globalThis.ReadableStream = require('stream/web').ReadableStream;
    }
    if (typeof WritableStream === 'undefined') {
      globalThis.WritableStream = require('stream/web').WritableStream;
    }
    if (typeof TransformStream === 'undefined') {
      globalThis.TransformStream = require('stream/web').TransformStream;
    }
  } catch (err) {
    // If the 'stream/web' import fails for some reason, just log a warning.
    console.warn('Warning: Could not polyfill Readable/Writable/Transform streams.', err.message);
  }
 /**
 * index.js
 * Usage: node index.js
 */
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');

/* ------------------------------------------------------------------
   TASK 1:
   SCRAPE DU BULLETIN FOR UPPER-DIVISION CS COURSES W/O PREREQUISITES
   ------------------------------------------------------------------ */
async function scrapeBulletin() {
  // Undergraduate COMP courses URL:
  const url = 'https://bulletin.du.edu/undergraduate/coursedescriptions/comp/';
  const results = { courses: [] };

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    $('div.courseblock').each((_idx, el) => {
      const titleText = $(el).find('p.courseblocktitle').text().trim();
      const descText  = $(el).find('p.courseblockdesc').text().trim();

      // Example format: "COMP 3000 Intro to X (4 Credits)"
      const match = titleText.match(/(COMP\s*\d+)\s+(.*)\(\d+.*\)/);
      if (match) {
        // Convert "COMP 3000" → "COMP-3000"
        const courseCode = match[1].replace(/\s+/, '-').trim();
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
                title: courseTitle
              });
            }
          }
        }
      }
    });

    await fs.ensureDir('results');
    await fs.writeJson('results/bulletin.json', results, { spaces: 2 });
    console.log(
      '✅  bulletin.json →',
      results.courses.length,
      'upper-division COMP courses without prereqs'
    );
  } catch (err) {
    console.error('❌  Error scraping DU Bulletin:', err.message);
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
  const url = 'https://denverpioneers.com/sports/mens-soccer/schedule';
  const results = { events: [] };

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Each match is often in a .schedule-game or .schedule-listing container
    // Adjust as needed to reflect the actual classes used
    $('.schedule-game, .schedule-listing').each((_idx, el) => {
      // Date might appear in a .schedule-game-date or .schedule-date
      const dateText = $(el).find('.schedule-game-date').text().trim()
                     || $(el).find('.schedule-date').text().trim()
                     || 'TBA';
      // Opponent might appear in .schedule-game-opponent-name, .opponent-name, etc.
      const opponent = $(el).find('.schedule-game-opponent-name, .opponent-name')
                        .text().trim() || 'Opponent';

      // Hard-code DU Team as "Denver" or "DU"
      const duTeam = 'Denver';

      results.events.push({
        duTeam,
        opponent,
        date: dateText
      });
    });

    await fs.ensureDir('results');
    await fs.writeJson('results/athletic_events.json', results, { spaces: 2 });
    console.log(
      '✅  athletic_events.json →',
      results.events.length,
      'events from Men’s Soccer schedule'
    );
  } catch (err) {
    console.error('❌  Error scraping Athletics:', err.message);
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
  const url = 'https://www.du.edu/calendar';
  const results = { events: [] };

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // 1) Attempt to locate the __NEXT_DATA__ script
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (!nextDataScript) {
      console.log('⚠️  No __NEXT_DATA__ script found on the DU Calendar page.');
    } else {
      // 2) Parse the JSON
      let nextData;
      try {
        nextData = JSON.parse(nextDataScript);
      } catch (parseErr) {
        console.log('⚠️  Could not parse __NEXT_DATA__ JSON:', parseErr.message);
      }

      // 3) If we have valid nextData, see if there's an "events" array or an "apolloState" with event objects
      if (nextData && nextData.props && nextData.props.pageProps) {
        const pageProps = nextData.props.pageProps;

        // The site might store events in "pageProps.apolloState" or "pageProps.events".
        // Inspect the JSON structure in your browser if this changes.
        const apolloState = pageProps.apolloState;
        if (apolloState) {
          // Each event might appear in keys like "Event:12345"
          for (const key of Object.keys(apolloState)) {
            if (key.startsWith('Event:')) {
              const eventObj = apolloState[key];
              // Check if there's a startDate in 2025
              if (eventObj.startDate) {
                const dt = new Date(eventObj.startDate);
                if (dt.getFullYear() === 2025) {
                  const eventData = {
                    title: eventObj.title || 'Untitled Event',
                    date: eventObj.startDate
                  };
                  // if there's a description
                  if (eventObj.description) {
                    eventData.description = eventObj.description;
                  }
                  // if there's a distinct time, we might parse it
                  // (some sites combine date/time in eventObj.startDate)
                  results.events.push(eventData);
                }
              }
            }
          }
        } else if (pageProps.events && Array.isArray(pageProps.events)) {
          // If there's a direct events array
          pageProps.events.forEach(evt => {
            if (evt.startDate) {
              const dt = new Date(evt.startDate);
              if (dt.getFullYear() === 2025) {
                const item = {
                  title: evt.title || 'Untitled Event',
                  date: evt.startDate
                };
                if (evt.description) {
                  item.description = evt.description;
                }
                results.events.push(item);
              }
            }
          });
        }
      }
    }

    // 4) If no events were found for 2025, add a fallback
    if (results.events.length === 0) {
      console.log('⚠️  No 2025 events found in the server-rendered data. Using a fallback.');
      results.events.push({
        title: 'No 2025 Events Found',
        date: 'N/A',
        description: 'This site appears fully JS-driven with no 2025 data in the HTML.'
      });
    }

    await fs.ensureDir('results');
    await fs.writeJson('results/calendar_events.json', results, { spaces: 2 });
    console.log(
      '✅  calendar_events.json →',
      results.events.length,
      'events (or fallback) for 2025'
    );
  } catch (err) {
    console.error('❌  Error scraping DU Calendar:', err.message);

    // As a final fallback, write a placeholder event so the file is not empty
    const fallback = {
      events: [
        {
          title: 'Calendar Page Error',
          date: 'N/A',
          description: err.message
        }
      ]
    };
    await fs.ensureDir('results');
    await fs.writeJson('results/calendar_events.json', fallback, { spaces: 2 });
    console.log('⚠️  Wrote a fallback event in calendar_events.json due to error.');
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

  // 3. Calendar (2025)
  await scrapeCalendarEvents2025();
})();
