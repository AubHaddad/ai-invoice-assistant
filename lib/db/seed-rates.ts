import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { exchangeRates } from "./schema";
import { SEEDED_EXCHANGE_RATES } from "@/lib/money/seed-rates";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const db = drizzle(databaseUrl);

async function seedRates() {
  await db.delete(exchangeRates);

  const rows = await db
    .insert(exchangeRates)
    .values(
      SEEDED_EXCHANGE_RATES.map((quote) => ({
        fromCurrency: quote.fromCurrency,
        toCurrency: quote.toCurrency,
        rate: quote.rate,
        effectiveDate: quote.effectiveDate,
      })),
    )
    .returning({
      fromCurrency: exchangeRates.fromCurrency,
      toCurrency: exchangeRates.toCurrency,
      rate: exchangeRates.rate,
      effectiveDate: exchangeRates.effectiveDate,
    });

  console.log(`Seeded ${rows.length} exchange rates (MAD / EUR / USD):`);
  for (const row of rows) {
    console.log(
      `  ${row.effectiveDate}  1 ${row.fromCurrency} = ${row.rate} ${row.toCurrency}`,
    );
  }
}

seedRates()
  .catch((error) => {
    console.error("Rate seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
