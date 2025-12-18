# Deployment Guide

## GitHub Pages Deployment

### Step 1: Create a GitHub Repository

1. Create a new repository on GitHub
2. Don't initialize with README, .gitignore, or license (we already have these)

### Step 2: Push Your Code

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Emoji Recognition Scanner"

# Add your GitHub repository as remote
git remote add origin https://github.com/yourusername/your-repo-name.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select:
   - Branch: `main` (or `master`)
   - Folder: `/ (root)`
4. Click **Save**
5. Wait a few minutes for GitHub to build your site
6. Your site will be available at: `https://yourusername.github.io/your-repo-name/`

### Step 4: Add Your Model Files

**Important:** Model files are ignored by `.gitignore` by default. To include them:

1. Remove the model file patterns from `.gitignore`, OR
2. Force add the model files:

```bash
git add -f model/model.json model/metadata.json model/weights.bin
git commit -m "Add model files"
git push
```

### Step 5: Update Redirect URLs

Edit `app.js` and update the `REDIRECTS` object with your actual URLs before deploying.

## Custom Domain (Optional)

1. Add a `CNAME` file to your repository root with your domain name
2. Configure DNS settings with your domain provider
3. Update GitHub Pages settings to use your custom domain

## Troubleshooting

### Model files not loading on GitHub Pages
- Ensure model files are committed to the repository
- Check that file paths in `app.js` are correct (use absolute paths starting with `/`)
- Verify files are accessible by visiting `https://yourusername.github.io/your-repo-name/model/model.json` directly

### Camera not working
- GitHub Pages provides HTTPS automatically, so camera should work
- Check browser console for permission errors
- Ensure you've allowed camera access in browser settings

### 404 errors
- Make sure `index.html` is in the root directory
- Verify GitHub Pages is enabled and pointing to the correct branch
- Wait a few minutes after enabling Pages for the site to build

