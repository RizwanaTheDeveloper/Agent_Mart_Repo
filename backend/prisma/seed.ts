/**
 * Seeds baseline data (settings row + plans) and, when SEED_DEMO_DATA=true, FICTIONAL demo records
 * so every admin screen has something to show. No administrator is created here -
 * use `npm run admin:create` (there is deliberately no default password).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length];
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function main() {
  await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  const plans = [
    { name: 'Starter', maxStaff: 3, maxListings: 25, priceInr: 0 },
    { name: 'Professional', maxStaff: 10, maxListings: 200, priceInr: 4999 },
    { name: 'Enterprise', maxStaff: 50, maxListings: 2000, priceInr: 19999 },
  ];
  for (const p of plans) await prisma.plan.upsert({ where: { name: p.name }, create: p, update: {} });
  console.log('✔ settings + plans');

  if (process.env.SEED_DEMO_DATA !== 'true') return;
  if (process.env.NODE_ENV === 'production') throw new Error('SEED_DEMO_DATA is for local development only and is refused in production');
  if ((await prisma.firm.count()) > 0) {
    console.log('ℹ demo data skipped (firms already exist)');
    return;
  }

  const cities = ['Hyderabad', 'Warangal', 'Vijayawada', 'Visakhapatnam', 'Karimnagar'] as const;
  const types = ['plot', 'apartment', 'villa', 'agricultural', 'commercial'] as const;
  const firmNames = ['Demo Realty One', 'Sample Estates', 'Example Homes', 'Placeholder Properties', 'Fictional Land Co', 'Test Developers'];
  const allPlans = await prisma.plan.findMany();

  for (let f = 0; f < firmNames.length; f++) {
    const firm = await prisma.firm.create({
      data: {
        name: firmNames[f],
        suspended: f === 5,
        suspendedAt: f === 5 ? daysAgo(2) : null,
        createdAt: daysAgo(60 - f * 5),
        subscriptions: { create: { planId: pick(allPlans, f).id } },
      },
    });

    for (let u = 0; u < 3; u++) {
      await prisma.account.create({
        data: {
          name: `Seller ${f + 1}.${u + 1}`,
          email: `seller${f + 1}.${u + 1}@example.test`,
          role: 'seller',
          firmId: firm.id,
          active: u !== 2,
          createdAt: daysAgo((f * 7 + u * 3) % 30),
        },
      });
    }

    for (let l = 0; l < 5; l++) {
      const i = f * 5 + l;
      const listing = await prisma.listing.create({
        data: {
          title: `${pick(types, i)} near ${pick(cities, i)} #${i + 1}`,
          firmId: firm.id,
          type: pick(types, i),
          city: pick(cities, i),
          priceInr: 1_500_000 + i * 275_000,
          latitude: 17 + (i % 10) * 0.05,
          longitude: 78 + (i % 10) * 0.05,
          sellerPublished: i % 3 !== 0,
          moderation: pick(['pending', 'reviewed', 'reviewed', 'blocked', 'info_requested'] as const, i),
          createdAt: daysAgo(i % 30),
        },
      });
      await prisma.listingSummary.create({
        data: {
          propertyId: listing.id,
          sourceVersion: 1,
          language: pick(['en', 'te', 'hi'], i),
          kind: 'listing_overview',
          summary: `Fictional AI summary for demo listing ${i + 1}. Not real property data.`,
          approved: i % 2 === 0,
          blocked: i % 7 === 0,
        },
      });
      await prisma.listingDocument.create({
        data: {
          firmId: firm.id,
          propertyId: listing.id,
          label: `Demo document ${i + 1}`,
          mime: 'application/pdf',
          sizeBytes: 120_000 + i * 1000,
          storageKey: `demo/encrypted/${listing.id}.bin`,
        },
      });
    }
  }

  const buyers = await Promise.all(
    Array.from({ length: 8 }, (_, b) =>
      prisma.account.create({
        data: { name: `Buyer ${b + 1}`, email: `buyer${b + 1}@example.test`, role: 'buyer', createdAt: daysAgo(b * 3) },
      }),
    ),
  );
  const listings = await prisma.listing.findMany({ take: 20 });
  const stages = ['enquiry', 'site_visit_requested', 'site_visit_scheduled', 'site_visit_completed', 'negotiation'] as const;
  for (let n = 0; n < 20; n++) {
    await prisma.interest.create({
      data: {
        propertyId: pick(listings, n).id,
        buyerId: pick(buyers, n).id,
        stage: pick(stages, n),
        status: n % 9 === 0 ? 'closed' : 'open',
        messageCount: (n * 3) % 11,
        createdAt: daysAgo(n % 30),
      },
    });
  }
  for (let c = 0; c < 8; c++) {
    await prisma.reportCase.create({
      data: {
        propertyId: pick(listings, c * 2).id,
        reporterId: pick(buyers, c).id,
        category: pick(['misleading_info', 'duplicate', 'suspected_fraud', 'unresponsive_seller'], c),
        description: `Fictional buyer report #${c + 1} for demo purposes.`,
        status: pick(['open', 'investigating', 'resolved', 'dismissed'] as const, c),
        createdAt: daysAgo(c * 3),
      },
    });
  }
  await prisma.announcement.createMany({
    data: [
      { title: 'Welcome to Agent Mart', body: 'Demo announcement for all users.', audience: 'all', active: true },
      { title: 'Seller verification update', body: 'Demo notice for sellers.', audience: 'sellers', active: false },
    ],
  });
  console.log('✔ fictional demo data');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
