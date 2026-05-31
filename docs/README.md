# Hoard — Landing Page

This folder contains the GitHub Pages website for Hoard.

## Enable GitHub Pages

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under "Build and deployment" → Source: **Deploy from a branch**
3. Branch: `master` (or `main`) · Folder: `/docs`
4. Click **Save**

Your site will be live at: `https://XsharklinX.github.io/Hoard/`

## Local preview

```bash
# Using Python
python -m http.server 8080 --directory docs

# Using Node
npx serve docs
```

Open `http://localhost:8080`
