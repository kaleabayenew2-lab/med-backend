const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const GIST_ID = '6244be2a45af50397be6ea1c8108e0fa';

async function updateBackendUrl(url) {
  if (!process.env.GITHUB_TOKEN) {
    console.warn('⚠️ GITHUB_TOKEN is not configured. Skipping GitHub Gist update.');
    return false;
  }

  try {
    await octokit.gists.update({
      gist_id: GIST_ID,
      files: {
        'backend.txt': {
          content: url,
        },
      },
    });

    console.log(`✅ GitHub Gist updated with URL: ${url}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to update Gist:', error && error.message ? error.message : error);
    return false;
  }
}

module.exports = { updateBackendUrl };