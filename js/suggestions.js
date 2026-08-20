/* Suggestion library for New Year's bingo tiles, grouped by category. */
const SUGGESTIONS = {
  "Adventure": [
    "Watch a sunrise",
    "Visit a town I've never been to",
    "Take a spontaneous weekend trip",
    "Swim in an ocean, lake, or river",
    "Go camping under the stars",
    "Hike a trail that's new to me",
    "Ride a train somewhere",
    "See a place on my list for years",
    "Take a road trip with no fixed plan",
    "Watch a meteor shower"
  ],
  "Health & Movement": [
    "Run a 5K",
    "Try a new workout class",
    "Walk 10,000 steps for a week straight",
    "Stretch every morning for a month",
    "Sleep 8 hours for 7 nights in a row",
    "Go a week without soda",
    "Learn to do a proper push-up",
    "Bike somewhere I'd normally drive",
    "Drink water first thing every day for a month",
    "Take a rest day without guilt"
  ],
  "Creativity": [
    "Finish a creative project",
    "Learn 3 songs on an instrument",
    "Write in a journal for 30 days",
    "Take a photo every day for a month",
    "Paint or draw something",
    "Write a short story",
    "Start a blog, newsletter, or zine",
    "Make something with my hands",
    "Learn a new recipe from scratch",
    "Sing karaoke in public"
  ],
  "Learning": [
    "Read 12 books",
    "Learn 100 words in a new language",
    "Take an online course start to finish",
    "Watch a documentary that changes my mind",
    "Learn a card trick or party skill",
    "Teach someone something I know",
    "Read a book outside my usual genre",
    "Memorize a poem",
    "Learn basic first aid",
    "Understand something I've always avoided"
  ],
  "Connection": [
    "Host a dinner party",
    "Call an old friend out of the blue",
    "Write a real letter and mail it",
    "Meet a neighbor properly",
    "Plan a trip with friends",
    "Have a phone-free evening with someone",
    "Say yes to an invite I'd normally skip",
    "Tell someone what they mean to me",
    "Make one new friend",
    "Reconnect with a family member"
  ],
  "Home & Money": [
    "Declutter one room completely",
    "Build a starter emergency fund",
    "Cancel a subscription I don't use",
    "Cook at home 5 nights in a week",
    "Fix the thing that's been broken",
    "Set up an automatic savings transfer",
    "Do a no-spend week",
    "Organize my digital photos",
    "Make a budget I actually follow",
    "Donate what I no longer use"
  ],
  "Joy & Rest": [
    "See live music",
    "Have a whole day with no plans",
    "Go to a museum or gallery",
    "Try a restaurant I've never been to",
    "Watch a movie in a theater alone",
    "Take a real vacation and unplug",
    "Dance like nobody's watching",
    "Spend an afternoon reading in the sun",
    "Try a food I've always avoided",
    "Do something purely because it's fun"
  ],
  "Growth": [
    "Say no to something that drains me",
    "Ask for what I want at work",
    "Face a fear head-on",
    "Go a month without doom-scrolling",
    "Start therapy or journaling regularly",
    "Forgive someone (or myself)",
    "Break a habit I keep defending",
    "Volunteer for a cause I care about",
    "Set a boundary and keep it",
    "Do the scary thing I keep postponing"
  ]
};

const CATEGORY_ORDER = Object.keys(SUGGESTIONS);

/* Flat list of every suggestion with its category attached. */
function allSuggestions() {
  return CATEGORY_ORDER.flatMap(cat =>
    SUGGESTIONS[cat].map(text => ({ text, category: cat }))
  );
}
