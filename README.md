# Home – our apartment app

A shared web app for organizing the apartment. Built section by section.

**Sections**
- ✅ Home: front page with a shared photo, shopping & project counts, and everyone's to-dos
- ✅ Shopping lists: several lists, categories (incl. your own and one-time ones), move items between lists, check off, see who added what, live sync
- ✅ Projects: by room, type, priority and status; tasks & next steps, links to solutions, budget & costs, photos & files, notes
- ✅ Ideas: a suggestion box for new features – status (new / planned / done / not now), 👍 to agree, copy the open ones as a list
- ⏳ More to come

## How it works
- Plain HTML/CSS/JavaScript, no build step. Hosted on GitHub Pages.
- Data and logins in Supabase. Only users created in Supabase can sign in.

## Setup (one time)
1. **Database:** Supabase → SQL Editor → paste `supabase/01_shopping.sql` → Run. Then do the same with `supabase/02_projects.sql`, `supabase/03_home.sql`, `supabase/04_suggestions.sql` and `supabase/05_shopping_categories.sql`.
2. **Turn off public sign-ups:** Supabase → Authentication → Sign In / Providers → turn off *Allow new users to sign up* → Save.
3. **Create the two users:** Authentication → Users → Add user → Create new user (email + password, tick *Auto Confirm User*).
4. **Publish:** GitHub repo → Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
5. Open `https://<username>.github.io/apartment-app/` and sign in. On a phone: Share → *Add to Home Screen*.

## Publishing updates
When you upload changed files to GitHub, open `index.html` and bump the version number in **all three places** (`app-version`, `style.css?v=`, `app.js?v=`), e.g. 2 → 3, and upload it too. The home-screen app checks this number each time it's opened and reloads itself when it changes.
