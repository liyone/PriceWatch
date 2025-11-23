
import * as fs from 'fs';
import * as path from 'path';

const HISTORY_FILE = path.join(__dirname, '../data/history.json');

function generateId(ticker: string, date: string, transactionType: string, amount: string): string {
  const idString = `${ticker}-${date}-${transactionType}-${amount}`;
  let hash = 0;
  for (let j = 0; j < idString.length; j++) {
    const char = idString.charCodeAt(j);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `qq-${Math.abs(hash).toString(16)}`;
}

function main() {
  if (!fs.existsSync(HISTORY_FILE)) {
    console.error('History file not found');
    return;
  }

  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) as string[];
  console.log(`Loaded ${history.length} items from history`);

  // Pelosi's latest trade
  const pelosiId = generateId(
    "AAPLAPPLE INC. - COMMON STOCKStock",
    "Oct 24, 2025",
    "Sale",
    ""
  );
  console.log(`Generated Pelosi ID: ${pelosiId}`);

  // MTG's latest trade
  const mtgId = generateId(
    "ADPAUTOMATIC DATA PROCESSING, INC. - COMMON STOCKStock",
    "Nov 13, 2025",
    "Sale",
    ""
  );
  console.log(`Generated MTG ID: ${mtgId}`);

  const newHistory = history.filter(id => id !== pelosiId && id !== mtgId);
  
  if (newHistory.length < history.length) {
    console.log(`Removed ${history.length - newHistory.length} items`);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(newHistory), 'utf8');
    console.log('History updated');
  } else {
    console.log('No items matched for removal. Checking partial matches...');
    // Debugging: check if generated IDs are close or if I messed up the inputs
    // But for now, just report.
  }
}

main();
