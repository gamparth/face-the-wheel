/**
 * generate-gifs.js
 *
 * Run this ONCE before starting the bot:
 *   node generate-gifs.js
 *
 * Creates one GIF per dare in the ./gifs/ folder:
 *   gifs/spin-0.gif  … gifs/spin-19.gif
 *
 * After generation, the bot reads these files at runtime — zero
 * computation needed when someone actually spins.
 */

const { generateSpinGif } = require("./wheel");
const { dares } = require("./dares");
const fs = require("fs");
const path = require("path");

const GIFS_DIR = path.join(__dirname, "gifs");

async function main() {
  fs.mkdirSync(GIFS_DIR, { recursive: true });

  console.log(`\n🎡  Generating ${dares.length} dare wheel GIFs...\n`);
  const start = Date.now();

  for (let i = 0; i < dares.length; i++) {
    const label = `  [${String(i + 1).padStart(2, " ")}/${dares.length}]  Dare #${i + 1}`;
    process.stdout.write(`${label}  …`);

    const tmpPath = await generateSpinGif(i, dares);
    const destPath = path.join(GIFS_DIR, `spin-${i}.gif`);
    fs.renameSync(tmpPath, destPath);

    const kb = (fs.statSync(destPath).size / 1024).toFixed(0);
    console.log(`  ✓  ${kb} KB`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `\n✅  All ${dares.length} GIFs saved to ./gifs/  (${elapsed}s total)\n`,
  );
  console.log("You can now start the bot:  node app.js\n");
}

main().catch((err) => {
  console.error("\n❌  Generation failed:", err.message);
  process.exit(1);
});
