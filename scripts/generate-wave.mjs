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

function levelFor(count) {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}


function buildSvg(weeks, { basePalette, gradFrom, gradTo, name }) {
  const cell = 11;
  const gap = 3;
  const step = cell + gap;
  const width = weeks.length * step - gap;
  const height = 7 * step - gap;
  
  const cycle = 6; // Senin ayarladığın yavaşlatılmış döngü süresi

  let cells = "";
  weeks.forEach((week, wi) => {
    week.contributionDays.forEach((day, di) => {
      const x = wi * step;
      const y = di * step;
      const level = levelFor(day.contributionCount);
      const fill = basePalette[level];

      // Senin ayarladığın yavaşlatılmış gecikme süresi
      const delay = ((wi + di) * 0.07).toFixed(3);

      // KRİTİK: Her iki kutuya da merkezden büyüyüp küçülmeleri için transform-origin eklendi
      cells += `<g>
        <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${fill}" class="base" style="animation-delay:${delay}s; transform-origin:${x + cell / 2}px ${y + cell / 2}px"/>
        <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="url(#waveGrad)" filter="url(#glow)" class="wave" style="animation-delay:${delay}s; transform-origin:${x + cell / 2}px ${y + cell / 2}px"/>
      </g>`;
    });
  });

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name} contribution wave">
<defs>
  <radialGradient id="waveGrad" cx="50%" cy="50%" r="65%">
    <stop offset="0%" stop-color="${gradFrom}"/>
    <stop offset="100%" stop-color="${gradTo}"/>
  </radialGradient>
  <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="1.3" result="blur"/>
    <feMerge>
      <feMergeNode in="blur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>
<style>
  g { animation: none; }
  .base {
    opacity: 1;
    animation: wipeOut ${cycle}s ease-in-out infinite;
  }
  .wave {
    opacity: 0;
    animation: wipeIn ${cycle}s ease-in-out infinite;
  }
  
  /* GERÇEKÇİ DALGA ETKİSİ - ANA KUTU: Kutu kararınca %75 boyutuna küçülür (içe çöker) */
  @keyframes wipeOut {
    0%, 5%, 80%, 100% { opacity: 1; transform: scale(1); }
    10%, 60% { opacity: 0.08; transform: scale(0.75); } 
  }
  
  /* GERÇEKÇİ DALGA ETKİSİ - MAVİ PARLAMA: Dalga vurduğunda çok daha fazla şişer (scale 1.6) */
  @keyframes wipeIn {
    0%, 25%, 100% { opacity: 0; transform: scale(0.8); }
    10% { opacity: 1; transform: scale(1.6); }
  }
</style>
${cells}
</svg>`;
}

const PALETTES = {
  dark: {
    basePalette: ["#161b22", "#301e36", "#5b2552", "#8c2d6f", "#c23a86"],
    gradFrom: "#eafdff",
    gradTo: "#39d3f0",
    name: "dark",
  },
  light: {
    basePalette: ["#ebedf0", "#f5c2dc", "#e888b8", "#d95a96", "#c23a86"],
    gradFrom: "#ffffff",
    gradTo: "#0969da",
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
