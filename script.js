const GITHUB_USERNAME = "Krishagarwal558";
const API_BASE = "https://api.github.com";

const repoCountEl = document.getElementById("repo-count");
const commitCountEl = document.getElementById("commit-count");
const languageListEl = document.getElementById("language-list");
const statusEl = document.getElementById("stats-status");

function formatNumber(value) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
}

function parseLastPage(linkHeader) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return match ? Number(match[1]) : null;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }

  return {
    data: await response.json(),
    link: response.headers.get("Link"),
  };
}

async function fetchAllRepos() {
  let page = 1;
  let repos = [];

  while (page <= 10) {
    const url = `${API_BASE}/users/${GITHUB_USERNAME}/repos?per_page=100&page=${page}&sort=updated&type=owner`;
    const { data, link } = await fetchJson(url);
    repos = repos.concat(data);

    const lastPage = parseLastPage(link);
    if (!lastPage || page >= lastPage || data.length === 0) break;
    page += 1;
  }

  return repos;
}

async function fetchCommitCount(repoName) {
  const url = `${API_BASE}/repos/${GITHUB_USERNAME}/${repoName}/commits?author=${GITHUB_USERNAME}&per_page=1`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (response.status === 404 || response.status === 409) return 0;
  if (!response.ok) throw new Error(`Commit fetch failed for ${repoName}`);

  const lastPage = parseLastPage(response.headers.get("Link"));
  if (lastPage) return lastPage;

  const commits = await response.json();
  return Array.isArray(commits) ? commits.length : 0;
}

function renderLanguages(repos) {
  const languages = [...new Set(repos.map((repo) => repo.language).filter(Boolean))];
  const fallback = ["Python", "JavaScript", "TypeScript", "HTML", "CSS"];
  const items = languages.length ? languages : fallback;

  languageListEl.innerHTML = "";
  items.slice(0, 8).forEach((language) => {
    const chip = document.createElement("span");
    chip.textContent = language;
    languageListEl.appendChild(chip);
  });
}

async function loadGitHubStats() {
  try {
    const repos = await fetchAllRepos();
    const sourceRepos = repos.filter((repo) => !repo.fork);

    repoCountEl.textContent = formatNumber(repos.length);
    renderLanguages(repos);

    const commitResults = await Promise.allSettled(
      sourceRepos.map((repo) => fetchCommitCount(repo.name)),
    );

    const successfulCounts = commitResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    const totalCommits = successfulCounts.reduce((sum, count) => sum + count, 0);
    commitCountEl.textContent = successfulCounts.length
      ? formatNumber(totalCommits)
      : "Public";

    statusEl.textContent =
      successfulCounts.length === sourceRepos.length
        ? "Live public GitHub data"
        : "Live data with partial commit access";
  } catch (error) {
    repoCountEl.textContent = "Public";
    commitCountEl.textContent = "Live";
    renderLanguages([]);
    statusEl.textContent = "GitHub API limit reached. Links still work.";
  }
}

loadGitHubStats();
