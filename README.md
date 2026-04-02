# personal-website

Personal portfolio website built with HTML, CSS, and JavaScript.

## Pages

- **Home** — Landing page with animated text
- **Contact** — Email link
- **Projects** — Showcase of current work
- **Resume** — Work experience, education, and certificates

## Tech Stack

- HTML / CSS / JavaScript
- Node.js (local dev server)
- Hosted via GitHub Pages

## Running Locally

```bash
npm install
node server.js
```

Then open your browser at `http://localhost:3000` (or whichever port server.js uses).

## Deployment

This site uses the `release` branch for GitHub Pages. To deploy, merge your changes from `main` into `release`:

```bash
git checkout release
git merge main
git push origin release
```

GitHub Pages will automatically serve the updated site from the `release` branch.

## Project Structure

```
personal-website/
├── index.html
├── Contact.html
├── projects.html
├── resume.html
├── header.html
├── footer.html
├── style.css
├── app.js
├── server.js
├── icon.ico
└── linkedinIcon.png
```
