# Deployment Guide (Vercel + R2)

Your website is optimized with a **Smart Caching System** (revalidates every 3 hours) to ensure it is fast and free for your friends to use.

## Prerequisites
1.  **GitHub Account**: [Create one](https://github.com/) if you don't have it.
2.  **Vercel Account**: [Create one](https://vercel.com/signup) using your GitHub account.

---

## Step 1: Push Code to GitHub
**Do not drag-and-drop files**. Use the terminal to push your code.

1.  **Create a New Repository** on GitHub:
    *   Go to [github.com/new](https://github.com/new).
    *   Name it `investment-website`.
    *   Make it **Private** (recommended since you have proprietary data logic) or Public.
    *   Click **Create repository**.

2.  **Connect & Push** (Run these commands in your VS Code terminal):
    *   *Replace `YOUR_USERNAME` with your actual GitHub username.*

    ```bash
    # Initialize git if not already done (you probably have it)
    git init

    # Add all files (we already ignored large files in .gitignore)
    git add .

    # Commit the changes
    git commit -m "Ready for Vercel deployment"

    # Link to your new GitHub repo
    # CHANGE 'YOUR_USERNAME' BELOW!
    git remote add origin https://github.com/YOUR_USERNAME/investment-website.git

    # Push the code
    git branch -M main
    git push -u origin main
    ```

---

## Step 2: Deploy to Vercel

1.  Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click **"Add New..."** -> **"Project"**.
3.  **Import Git Repository**: You should see `investment-website` in the list. Click **Import**.
4.  **Configure Project**:
    *   **Framework Preset**: Next.js (Default).
    *   **Root Directory**: `./` (Default).
    *   **Environment Variables** (CRITICAL):
        Expand the "Environment Variables" section and add the keys exactly as they appear in your local `.env` file:
        
        | Key | Value |
        | --- | --- |
        | `R2_ENDPOINT` | Copy specific URL from your .env |
        | `R2_ACCESS_KEY_ID` | Copy from .env |
        | `R2_SECRET_ACCESS_KEY` | Copy from .env |
        | `R2_BUCKET` | `broker-data` (or from .env) |

5.  Click **Deploy**.

---

## Step 3: Verify Speed
*   **First Load**: Might take 10-20 seconds (Server is downloading 150MB of data from R2).
*   **Second Load**: Should be **INSTANT**.
*   **Updates**: The server checks for updates every **3 hours**.

## Troubleshooting
*   **"No Data" on Vercel**: Check your Environment Variables. The `R2_ENDPOINT` must be correct (usually `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).
*   **Build Fail**: Check Vercel logs. Ensure `package-lock.json` was pushed.
