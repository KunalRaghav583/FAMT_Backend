import {
  PrismaClient,
  Role,
  AssetStatus,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

export async function seed(): Promise<void> {
  console.log("Starting idempotent database seed...");

  // 1. Seed Users (1 Admin, 1 Technician, 1 Viewer)
  const defaultPasswordHash = await bcrypt.hash("Password123!", SALT_ROUNDS);

  const usersData = [
    {
      name: "Site Operations Admin",
      email: "admin@famt.dev",
      passwordHash: defaultPasswordHash,
      role: Role.Admin,
    },
    {
      name: "Field Service Technician",
      email: "tech@famt.dev",
      passwordHash: defaultPasswordHash,
      role: Role.Technician,
    },
    {
      name: "Compliance Auditor",
      email: "viewer@famt.dev",
      passwordHash: defaultPasswordHash,
      role: Role.Viewer,
    },
  ];

  const users: Record<string, { id: string; email: string; role: Role }> = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
      },
      create: u,
    });
    users[u.role] = { id: user.id, email: user.email, role: user.role };
  }
  console.log(`✓ Seeded/verified ${Object.keys(users).length} users`);

  const admin = users[Role.Admin];
  const tech = users[Role.Technician];
  if (!admin || !tech) {
    throw new Error("Failed to initialize required admin or technician user");
  }

  // 2. Seed Sites (2 Sites)
  const sitesData = [
    {
      name: "Permian Basin Extraction Site A",
      location: "Midland, TX",
    },
    {
      name: "Gulf Coast Refining Plant 4",
      location: "Baytown, TX",
    },
  ];

  const sites: { id: string; name: string }[] = [];
  for (const s of sitesData) {
    const existing = await prisma.site.findFirst({
      where: { name: s.name },
    });
    if (existing) {
      sites.push({ id: existing.id, name: existing.name });
    } else {
      const created = await prisma.site.create({ data: s });
      sites.push({ id: created.id, name: created.name });
    }
  }
  console.log(`✓ Seeded/verified ${sites.length} sites`);

  const site1 = sites[0];
  const site2 = sites[1];
  if (!site1 || !site2) {
    throw new Error("Failed to initialize required sites");
  }

  // 3. Seed Assets (10 Assets: 5 per site, varied statuses)
  const assetsData = [
    // Site 1 Assets
    {
      name: "Centrifugal Crude Pump Alpha",
      type: "Pump",
      serialNo: "PUMP-PB-001",
      status: AssetStatus.Active,
      siteId: site1.id,
    },
    {
      name: "Primary Diesel Backup Generator",
      type: "Generator",
      serialNo: "GEN-PB-002",
      status: AssetStatus.Active,
      siteId: site1.id,
    },
    {
      name: "Wellhead Pressure Sensor Array",
      type: "Sensor",
      serialNo: "SENS-PB-003",
      status: AssetStatus.Under_maintenance,
      siteId: site1.id,
    },
    {
      name: "High-Pressure Gas Compressor",
      type: "Compressor",
      serialNo: "COMP-PB-004",
      status: AssetStatus.Active,
      siteId: site1.id,
    },
    {
      name: "Decommissioned Hydraulic Booster",
      type: "Booster",
      serialNo: "BOOST-PB-005",
      status: AssetStatus.Retired,
      siteId: site1.id,
    },
    // Site 2 Assets
    {
      name: "Cooling Tower Circulation Pump",
      type: "Pump",
      serialNo: "PUMP-GC-006",
      status: AssetStatus.Under_maintenance,
      siteId: site2.id,
    },
    {
      name: "Emergency Power Turbine Unit",
      type: "Turbine",
      serialNo: "TURB-GC-007",
      status: AssetStatus.Active,
      siteId: site2.id,
    },
    {
      name: "Catalytic Chamber Temperature Sensor",
      type: "Sensor",
      serialNo: "SENS-GC-008",
      status: AssetStatus.Active,
      siteId: site2.id,
    },
    {
      name: "Vacuum Distillation Feed Pump",
      type: "Pump",
      serialNo: "PUMP-GC-009",
      status: AssetStatus.Under_maintenance,
      siteId: site2.id,
    },
    {
      name: "Flare Line Optical Flow Meter",
      type: "Sensor",
      serialNo: "FLOW-GC-010",
      status: AssetStatus.Active,
      siteId: site2.id,
    },
  ];

  const assets: { id: string; serialNo: string }[] = [];
  for (const a of assetsData) {
    const asset = await prisma.asset.upsert({
      where: { serialNo: a.serialNo },
      update: {
        name: a.name,
        type: a.type,
        status: a.status,
        siteId: a.siteId,
      },
      create: a,
    });
    assets.push({ id: asset.id, serialNo: asset.serialNo });
  }
  console.log(`✓ Seeded/verified ${assets.length} assets`);

  // 4. Seed Tickets (20 Tickets: varied priority, status, and due dates)
  const now = new Date();
  const pastDate1 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago (overdue if open)
  const pastDate2 = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4 days ago (overdue if open)
  const futureDate1 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days in future
  const futureDate2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days in future

  const ticketsData = [
    // 1-4 for Asset 0 (PUMP-PB-001)
    {
      title: "Replace mechanical seal on crude pump",
      description:
        "Severe vibration and fluid leakage detected at secondary mechanical seal housing.",
      priority: TicketPriority.Critical,
      status: TicketStatus.Open,
      dueDate: pastDate1, // Overdue open ticket
      assetId: assets[0]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    {
      title: "Quarterly bearing lubrication check",
      description:
        "Inspect thrust bearing temperature and lubricate with synthetic grease per OEM spec.",
      priority: TicketPriority.Medium,
      status: TicketStatus.In_progress,
      dueDate: futureDate1,
      assetId: assets[0]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    // 5-6 for Asset 1 (GEN-PB-002)
    {
      title: "Annual diesel filter and oil service",
      description:
        "Drain engine oil, replace primary/secondary fuel filters, and test cold start.",
      priority: TicketPriority.High,
      status: TicketStatus.Open,
      dueDate: futureDate2,
      assetId: assets[1]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    {
      title: "Battery charging alternator inspection",
      description:
        "Low trickle voltage reported during automated weekly generator run test.",
      priority: TicketPriority.Low,
      status: TicketStatus.Resolved,
      dueDate: pastDate2,
      assetId: assets[1]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    // 7-8 for Asset 2 (SENS-PB-003)
    {
      title: "Recalibrate pressure transducer telemetry",
      description:
        "Transducer reading drift detected in SCADA historical trending data (+12 psi).",
      priority: TicketPriority.High,
      status: TicketStatus.Open,
      dueDate: pastDate2, // Overdue open ticket
      assetId: assets[2]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    {
      title: "Replace corrosion-damaged junction box",
      description:
        "Moisture ingress identified during visual safety walk-through inspection.",
      priority: TicketPriority.Medium,
      status: TicketStatus.In_progress,
      dueDate: futureDate1,
      assetId: assets[2]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    // 9-10 for Asset 3 (COMP-PB-004)
    {
      title: "Inspect stage-2 discharge valve reeds",
      description: "Pulsation dampener rattling during peak load compression cycle.",
      priority: TicketPriority.High,
      status: TicketStatus.Open,
      dueDate: futureDate1,
      assetId: assets[3]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    {
      title: "Scheduled intercooler cleaning",
      description: "Flush shell-and-tube gas cooler to remove paraffin wax buildup.",
      priority: TicketPriority.Low,
      status: TicketStatus.Closed,
      dueDate: pastDate1,
      assetId: assets[3]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    // 11 for Asset 4 (BOOST-PB-005)
    {
      title: "Decommissioning safety lock-out inspection",
      description:
        "Verify all hydraulic lines are depressurized, tagged, and locked out.",
      priority: TicketPriority.Medium,
      status: TicketStatus.Closed,
      dueDate: pastDate2,
      assetId: assets[4]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    // 12-13 for Asset 5 (PUMP-GC-006)
    {
      title: "Cooling tower pump impeller cavitation repair",
      description:
        "Suction head loss caused cavitation pitting along the leading impeller vane.",
      priority: TicketPriority.Critical,
      status: TicketStatus.In_progress,
      dueDate: futureDate1,
      assetId: assets[5]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    {
      title: "Motor stator thermal sensor replacement",
      description: "Faulty RTD sensor reporting intermittent open circuit false alarms.",
      priority: TicketPriority.Low,
      status: TicketStatus.Open,
      dueDate: futureDate2,
      assetId: assets[5]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    // 14-15 for Asset 6 (TURB-GC-007)
    {
      title: "Turbine governor speed actuator calibration",
      description:
        "Fine-tune hydraulic actuator response timing under sudden load shedding.",
      priority: TicketPriority.High,
      status: TicketStatus.Open,
      dueDate: futureDate1,
      assetId: assets[6]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    {
      title: "Exhaust stack thermocouple verification",
      description:
        "Compare turbine outlet gas temperature with certified reference thermocouple.",
      priority: TicketPriority.Medium,
      status: TicketStatus.Resolved,
      dueDate: pastDate1,
      assetId: assets[6]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    // 16-17 for Asset 7 (SENS-GC-008)
    {
      title: "Thermal barrier sheath replacement",
      description:
        "Ceramic thermal well showing micro-fractures under high-temperature cycling.",
      priority: TicketPriority.Critical,
      status: TicketStatus.Open,
      dueDate: pastDate1, // Overdue open ticket
      assetId: assets[7]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    {
      title: "Analog 4-20mA loop impedance test",
      description: "Verify loop integrity between transmitter and central DCS I/O rack.",
      priority: TicketPriority.Low,
      status: TicketStatus.In_progress,
      dueDate: futureDate1,
      assetId: assets[7]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    // 18-19 for Asset 8 (PUMP-GC-009)
    {
      title: "Vacuum distillation seal flush barrier oil refill",
      description:
        "Barrier oil reservoir level dropped below minimum operational sight glass line.",
      priority: TicketPriority.High,
      status: TicketStatus.In_progress,
      dueDate: futureDate1,
      assetId: assets[8]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    {
      title: "Coupling elastomer insert replacement",
      description:
        "Elastomeric drive spider shows dry rot and torsional cracking during inspection.",
      priority: TicketPriority.Medium,
      status: TicketStatus.Resolved,
      dueDate: pastDate2,
      assetId: assets[8]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    // 19 for Asset 1 (GEN-PB-002)
    {
      title: "Full emergency load bank test",
      description:
        "Perform 4-hour simulated load bank testing at 100% rated generator capacity.",
      priority: TicketPriority.High,
      status: TicketStatus.Resolved,
      dueDate: pastDate1,
      assetId: assets[1]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    // 20 for Asset 6 (TURB-GC-007)
    {
      title: "Annual vibration frequency spectrum analysis",
      description:
        "Analyze shaft displacement orbits and sub-synchronous harmonics under full speed.",
      priority: TicketPriority.Medium,
      status: TicketStatus.Open,
      dueDate: futureDate2,
      assetId: assets[6]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
    // 21 for Asset 9 (FLOW-GC-010)
    {
      title: "Optical flow sensor optical lens cleaning",
      description:
        "Soot deposition on infrared sapphire lens degrading optical transmission quality.",
      priority: TicketPriority.Medium,
      status: TicketStatus.Open,
      dueDate: futureDate2,
      assetId: assets[9]!.id,
      assigneeId: tech.id,
      createdBy: admin.id,
    },
  ];

  const tickets: { id: string; title: string }[] = [];
  for (const t of ticketsData) {
    const existing = await prisma.ticket.findFirst({
      where: {
        title: t.title,
        assetId: t.assetId,
      },
    });

    if (existing) {
      const updated = await prisma.ticket.update({
        where: { id: existing.id },
        data: {
          description: t.description,
          priority: t.priority,
          status: t.status,
          dueDate: t.dueDate,
          assigneeId: t.assigneeId,
          createdBy: t.createdBy,
        },
      });
      tickets.push({ id: updated.id, title: updated.title });
    } else {
      const created = await prisma.ticket.create({ data: t });
      tickets.push({ id: created.id, title: created.title });
    }
  }
  console.log(`✓ Seeded/verified ${tickets.length} tickets`);

  // 5. Seed sample comments on the first two tickets
  const firstTicket = tickets[0];
  if (firstTicket) {
    const existingComments = await prisma.comment.count({
      where: { ticketId: firstTicket.id },
    });
    if (existingComments === 0) {
      await prisma.comment.createMany({
        data: [
          {
            ticketId: firstTicket.id,
            userId: admin.id,
            body: "Emergency order placed for replacement mechanical seal kit.",
          },
          {
            ticketId: firstTicket.id,
            userId: tech.id,
            body: "Pump isolated and drained. Ready for seal replacement once parts arrive.",
          },
        ],
      });
      console.log("✓ Seeded sample comments on critical ticket");
    }
  }

  console.log("Idempotent database seed completed successfully.");
}

async function main(): Promise<void> {
  try {
    await seed();
  } catch (error) {
    console.error("Database seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
