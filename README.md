# Movie Catalog Web

A simple web front end for the [Movie Catalog API](https://github.com/brunocmg/movie-catalog-api): browse and search movies and series, rate them and keep personal lists.

Built with plain **HTML, CSS and JavaScript**, with no framework and no build step, so it can be hosted on any static host.

> **Note:** the application interface is in Brazilian Portuguese.

## Live demo

`<your-vercel-url>`

Click **Testar com conta demo** to sign in without registering. The demo account is a regular `USER`.

> **Note:** the API runs on Render's free plan and goes to sleep when idle. The first request can take about a minute, and the catalog stays empty until it wakes up.

## Features

- **Catalog:** search by name, filter by type and genre, sort and paginate.
- **Title details:** synopsis, genres, cast, average rating and reviews.
- **Accounts:** sign up, log in and log out. The access token is refreshed automatically, and refresh tokens are handled as single use.
- **Personal lists** (signed in): favorites, watchlist and ratings with an optional review, each with its own page.
- **One-click demo login** for anyone who wants to try it without registering.
- **Responsive layout** for desktop and mobile.

## Tech stack

- HTML, CSS and JavaScript (ES2020, no dependencies)
- Native `<dialog>` for modals and `fetch` for the API
- Hosted on Vercel

## Running locally

The API must be running (see its [README](https://github.com/brunocmg/movie-catalog-api#running-locally)).

```bash
git clone https://github.com/brunocmg/movie-catalog-web.git
cd movie-catalog-web
npx serve .          # or: python -m http.server 5500
```

Then open the printed address. If you serve the page from an origin other than `localhost` in development, the API must allow it in `CORS_ORIGINS`.

## Configuration

Everything is in [config.js](./config.js):

| Key | Description |
| --- | --- |
| `API_URL` | Base URL of the API (for example the Render URL or `http://localhost:3000`) |
| `DEMO_USER` | E-mail and password of the demo account used by the demo button |
| `PAGE_SIZE` | Titles per page |

You can also change the API URL at runtime with **Alterar URL da API** in the footer. It is saved in the browser only.

## Deploy

1. Push this folder to a GitHub repository.
2. On [Vercel](https://vercel.com), choose **Add New, Project**, import the repository, set **Framework Preset** to **Other** and leave the build command empty.
3. Set `API_URL` in `config.js` to the API URL.
4. On the API (Render), set `CORS_ORIGINS` to the exact Vercel URL, without trailing slash. Without it the browser blocks the requests.

Preview deployments have different URLs, so they are not allowed by CORS unless you add them to `CORS_ORIGINS`.

## Limitations

- Read-only for the catalog: creating or editing titles is an admin action, available through the API only.
- Tokens are kept in `localStorage`, which is acceptable for a demo but not the safest option for a production app.
- Lists show only the first 100 favorites and watchlist items when marking the buttons on a title.
- Free-plan hosting: cold start of about a minute after inactivity.

## Project structure

```
.
├── index.html    # page and dialogs
├── style.css
├── app.js        # API client, session handling and views
└── config.js     # API URL and demo account
```

## Author

- [Bruno Gomes](https://github.com/brunocmg)
