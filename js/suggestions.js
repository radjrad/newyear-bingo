/* Suggestion library for New Year's bingo tiles, grouped by category.
   Each goal carries a hand-written short form (s) that fits a phone-size
   tile without ellipsis; the full text (t) shows everywhere roomier. */
const SUGGESTIONS = {
  "Adventure": [
    { t: "Watch a sunrise", s: "Sunrise" },
    { t: "Visit a town I've never been to", s: "New town" },
    { t: "Take a spontaneous weekend trip", s: "Weekend trip" },
    { t: "Swim in an ocean, lake, or river", s: "Wild swim" },
    { t: "Go camping under the stars", s: "Camp out" },
    { t: "Hike a trail that's new to me", s: "New hike" },
    { t: "Ride a train somewhere", s: "Train ride" },
    { t: "See a place on my list for years", s: "Bucket-list spot" },
    { t: "Take a road trip with no fixed plan", s: "Road trip" },
    { t: "Watch a meteor shower", s: "Meteor shower" }
  ],
  "Health & Movement": [
    { t: "Run a 5K", s: "Run a 5K" },
    { t: "Try a new workout class", s: "New workout" },
    { t: "Walk 10,000 steps for a week straight", s: "10k-step week" },
    { t: "Stretch every morning for a month", s: "Daily stretch" },
    { t: "Sleep 8 hours for 7 nights in a row", s: "8-hour sleeps" },
    { t: "Go a week without soda", s: "No-soda week" },
    { t: "Learn to do a proper push-up", s: "Real push-up" },
    { t: "Bike somewhere I'd normally drive", s: "Bike, not drive" },
    { t: "Drink water first thing every day for a month", s: "Morning water" },
    { t: "Take a rest day without guilt", s: "Guilt-free rest" }
  ],
  "Creativity": [
    { t: "Finish a creative project", s: "Finish a project" },
    { t: "Learn 3 songs on an instrument", s: "Learn 3 songs" },
    { t: "Write in a journal for 30 days", s: "30-day journal" },
    { t: "Take a photo every day for a month", s: "Daily photo" },
    { t: "Paint or draw something", s: "Paint or draw" },
    { t: "Write a short story", s: "Short story" },
    { t: "Start a blog, newsletter, or zine", s: "Start a blog" },
    { t: "Make something with my hands", s: "Make something" },
    { t: "Learn a new recipe from scratch", s: "New recipe" },
    { t: "Sing karaoke in public", s: "Karaoke night" }
  ],
  "Learning": [
    { t: "Read 12 books", s: "Read 12 books" },
    { t: "Learn 100 words in a new language", s: "100 new words" },
    { t: "Take an online course start to finish", s: "Finish a course" },
    { t: "Watch a documentary that changes my mind", s: "Big documentary" },
    { t: "Learn a card trick or party skill", s: "Party trick" },
    { t: "Teach someone something I know", s: "Teach someone" },
    { t: "Read a book outside my usual genre", s: "New genre" },
    { t: "Memorize a poem", s: "Memorize a poem" },
    { t: "Learn basic first aid", s: "First aid basics" },
    { t: "Understand something I've always avoided", s: "Crack a mystery" }
  ],
  "Connection": [
    { t: "Host a dinner party", s: "Dinner party" },
    { t: "Call an old friend out of the blue", s: "Call old friend" },
    { t: "Write a real letter and mail it", s: "Mail a letter" },
    { t: "Meet a neighbor properly", s: "Meet a neighbor" },
    { t: "Plan a trip with friends", s: "Friends trip" },
    { t: "Have a phone-free evening with someone", s: "Phone-free night" },
    { t: "Say yes to an invite I'd normally skip", s: "Say yes" },
    { t: "Tell someone what they mean to me", s: "Tell them" },
    { t: "Make one new friend", s: "New friend" },
    { t: "Reconnect with a family member", s: "Reconnect" }
  ],
  "Home & Money": [
    { t: "Declutter one room completely", s: "Declutter room" },
    { t: "Build a starter emergency fund", s: "Emergency fund" },
    { t: "Cancel a subscription I don't use", s: "Cancel a sub" },
    { t: "Cook at home 5 nights in a week", s: "Cook 5 nights" },
    { t: "Fix the thing that's been broken", s: "Fix the thing" },
    { t: "Set up an automatic savings transfer", s: "Auto savings" },
    { t: "Do a no-spend week", s: "No-spend week" },
    { t: "Organize my digital photos", s: "Sort photos" },
    { t: "Make a budget I actually follow", s: "Real budget" },
    { t: "Donate what I no longer use", s: "Donate stuff" }
  ],
  "Joy & Rest": [
    { t: "See live music", s: "Live music" },
    { t: "Have a whole day with no plans", s: "No-plans day" },
    { t: "Go to a museum or gallery", s: "Museum day" },
    { t: "Try a restaurant I've never been to", s: "New restaurant" },
    { t: "Watch a movie in a theater alone", s: "Solo movie" },
    { t: "Take a real vacation and unplug", s: "Unplug trip" },
    { t: "Dance like nobody's watching", s: "Just dance" },
    { t: "Spend an afternoon reading in the sun", s: "Sunny reading" },
    { t: "Try a food I've always avoided", s: "Brave bite" },
    { t: "Do something purely because it's fun", s: "Pure fun" }
  ],
  "Growth": [
    { t: "Say no to something that drains me", s: "Say no" },
    { t: "Ask for what I want at work", s: "Ask at work" },
    { t: "Face a fear head-on", s: "Face a fear" },
    { t: "Go a month without doom-scrolling", s: "No doomscroll" },
    { t: "Start therapy or journaling regularly", s: "Start therapy" },
    { t: "Forgive someone (or myself)", s: "Forgive" },
    { t: "Break a habit I keep defending", s: "Break a habit" },
    { t: "Volunteer for a cause I care about", s: "Volunteer" },
    { t: "Set a boundary and keep it", s: "Set a boundary" },
    { t: "Do the scary thing I keep postponing", s: "The scary thing" }
  ]
};

const CATEGORY_ORDER = Object.keys(SUGGESTIONS);
const MY_GOALS = 'My goals';

/* The user's own saved goals, loaded by app.js at startup. */
let goalBank = [];

/* Flat list of every suggestion — the user's own bank first. */
function allSuggestions() {
  const mine = goalBank.map(g => ({ text: g.text, short: g.short, category: MY_GOALS }));
  const stock = CATEGORY_ORDER.flatMap(cat =>
    SUGGESTIONS[cat].map(({ t, s }) => ({ text: t, short: s, category: cat }))
  );
  return mine.concat(stock);
}
