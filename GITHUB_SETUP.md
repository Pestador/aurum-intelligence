# GitHub Setup Guide

This guide explains how to put Aurum Intelligence on GitHub.

## What You Need

- A GitHub account
- Git installed on your computer
- This project folder on your computer

## Step 1: Create a GitHub Repository

1. Sign in to GitHub
2. Click `New repository`
3. Name it something like:
   - `aurum-intelligence`
4. Keep it public if you want open-source distribution
5. Do not add a README from GitHub if you are pushing this existing folder
6. Create the repository

## Step 2: Open a Terminal in This Project Folder

If the folder is already a Git repo, check it with:

```powershell
git status
```

## Step 3: Connect the Local Repo to GitHub

Replace `YOUR_USERNAME` with your GitHub username:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/aurum-intelligence.git
```

If a remote already exists, use:

```powershell
git remote set-url origin https://github.com/YOUR_USERNAME/aurum-intelligence.git
```

## Step 4: Add and Commit the Files

```powershell
git add .
git commit -m "Initial Aurum Intelligence system"
```

Before push, verify no secrets are staged:

```powershell
git diff --cached
```

If you see real API keys, stop and remove them before pushing.

## Step 5: Push to GitHub

If your main branch is `master`:

```powershell
git push -u origin master
```

If your main branch is `main`:

```powershell
git push -u origin main
```

## Step 6: Verify the Repository

On GitHub, make sure these files are visible:

- `README.md`
- `INSTALL.md`
- `GITHUB_SETUP.md`
- `.env.example`
- `docs/API_REFERENCE.md`
- `docs/SECURITY_AND_KEYS.md`
- `package.json`
- `src/`
- `fixtures/`
- `test/`

## Recommended Extras

After publishing, add:

- a repository description
- a short project tagline
- topics such as `trading`, `gold`, `xauusd`, `multi-agent`, `nodejs`, `self-hosted`

## Optional Next Step

Once the GitHub repo exists, a future step can add:

- release tags
- screenshots
- API setup docs
- real provider integration docs
- contribution guidelines
