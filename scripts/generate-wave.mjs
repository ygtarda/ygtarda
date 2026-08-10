// Gerçek GitHub contribution verisini çeker ve "parçacık dalga" temalı
// animasyonlu iki SVG üretir (dark & light). Node 20+ gerektirir (global fetch).

import { writeFile, mkdir } from "node:fs/promises";

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_PAT;

if (!USERNAME || !TOKEN) {
  console.error("GH_USERNAME ve GH_PAT ortam değişkenleri gerekli.");
  process.exit(1);
}

const query = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

async function fetchContributions() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { login: USERNAME } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API hatası: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL hatası: ${JSON.stringify(json.errors)}`);
  }

  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

// GitHub'ın kendi eşiklerine yakın bir seviyelendirme (0-4)
function levelFor(count) {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

function buildSvg(weeks, { basePalette, waveColor, name }) {
  const cell = 11;
  const gap = 3;
  const step = cell + gap;
  const width = weeks.length * step - gap;
  const height = 7 * step - gap;

  let cells = "";
  weeks.forEach((week, wi) => {
    week.contributionDays.forEach((day, di) => {
      const x = wi * step;
      const y = di * step;
      const level = levelFor(day.contributionCount);
      const fill = basePalette[level];
      const delay = (wi * 0.045).toFixed(3);

      cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}"/>`;
      cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${waveColor}" class="wave" style="animation-delay:${delay}s"/>`;
    });
  });

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name} contribution wave">
<style>
.wave { opacity: 0; animation: pulse 4.5s ease-in-out infinite; }
@keyframes pulse {
  0%, 88%, 100% { opacity: 0; }
  94% { opacity: 0.65; }
}
</style>
${cells}
</svg>`;
}

const PALETTES = {
  dark: {
    basePalette: ["#161b22", "#301e36", "#5b2552", "#8c2d6f", "#c23a86"],
    waveColor: "#39d3f0",
    name: "dark",
  },
  light: {
    basePalette: ["#ebedf0", "#f5c2dc", "#e888b8", "#d95a96", "#c23a86"],
    waveColor: "#0969da",
    name: "light",
  },
};

async function main() {
  const weeks = await fetchContributions();
  await mkdir("dist", { recursive: true });

  for (const theme of Object.keys(PALETTES)) {
    const svg = buildSvg(weeks, PALETTES[theme]);
    const outPath = `dist/contrib-wave-${theme}.svg`;
    await writeFile(outPath, svg, "utf8");
    console.log(`Yazıldı: ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

