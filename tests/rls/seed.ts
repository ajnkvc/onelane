import type { PGlite } from "@electric-sql/pglite";

/**
 * seed.ts — deterministische Testdaten, eingespielt als Bootstrap-Rolle
 * (umgeht RLS = erhöhter/Tooling-Pfad; Trigger feuern trotzdem).
 */
async function id(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<string> {
  const res = await db.query<{ id: string }>(sql, params);
  return res.rows[0].id;
}

export type Seed = Awaited<ReturnType<typeof seed>>;

export async function seed(db: PGlite) {
  const mkUser = (email: string, typ: string) =>
    id(
      db,
      "insert into public.users (id,email,account_typ) values (gen_random_uuid(),$1,$2) returning id",
      [email, typ],
    );

  const studentA = await mkUser("studenta@test.de", "student");
  const studentB = await mkUser("studentb@test.de", "student");
  const inhaberA = await mkUser("inhabera@test.de", "school_staff");
  const verwaltungA = await mkUser("verwaltunga@test.de", "school_staff");
  const fahrlehrerA = await mkUser("fahrlehrera@test.de", "school_staff");
  // ghostU steht NUR als instructors.user_id, hat aber KEINE Schulrolle (Eskalationstest).
  const ghostU = await mkUser("ghost@test.de", "school_staff");
  const adminU = await mkUser("admin@test.de", "platform_staff");
  const supportU = await mkUser("support@test.de", "platform_staff");
  const moderatorU = await mkUser("mod@test.de", "platform_staff");
  const editorU = await mkUser("editor@test.de", "platform_staff");

  const role = (uid: string, r: string) =>
    db.query(
      "insert into public.platform_role_assignments (user_id,role) values ($1,$2)",
      [uid, r],
    );
  await role(adminU, "admin");
  await role(supportU, "support");
  await role(moderatorU, "moderator");
  await role(editorU, "editor");

  const mkSchool = (slug: string, listed: boolean) =>
    id(
      db,
      `insert into public.driving_schools
         (name,slug,land,ort,latitude,longitude,is_listed,is_verified)
       values ($1,$2,'DE','Muenchen',48.13,11.57,$3,true) returning id`,
      ["Fahrschule " + slug, slug, listed],
    );
  const schoolA = await mkSchool("a", true);
  const schoolUnlisted = await mkSchool("x", false);

  await db.query(
    "insert into public.school_billing (school_id,stripe_account_ref,abo_status) values ($1,'acct_123','saas_active')",
    [schoolA],
  );

  await db.query(
    "insert into public.school_members (user_id,school_id,rolle) values ($1,$2,'inhaber')",
    [inhaberA, schoolA],
  );
  await db.query(
    "insert into public.school_members (user_id,school_id,rolle) values ($1,$2,'verwaltung')",
    [verwaltungA, schoolA],
  );
  await db.query(
    "insert into public.school_members (user_id,school_id,rolle) values ($1,$2,'fahrlehrer')",
    [fahrlehrerA, schoolA],
  );

  await db.query(
    "insert into public.school_profiles (school_id,beschreibung,fuehrerscheinklassen) values ($1,'Profil A','{B,A}')",
    [schoolA],
  );
  await db.query(
    "insert into public.school_profiles (school_id,beschreibung) values ($1,'Profil X')",
    [schoolUnlisted],
  );
  // Stellenanzeige (Untertabelle) für Schreib-Verengungs-Test (Verwaltung vs. Fahrlehrer).
  await db.query(
    "insert into public.school_jobs (school_id,titel,slug) values ($1,'Fahrlehrer (m/w/d)','fahrlehrer-m-w-d-seed-a')",
    [schoolA],
  );

  // instrA ist mit dem Fahrlehrer-Account fahrlehrerA verknüpft (Zuweisungs-Kette).
  const instrA = await id(
    db,
    "insert into public.instructors (user_id,school_id,name,slug) values ($1,$2,'Lehrer A','lehrer-a') returning id",
    [fahrlehrerA, schoolA],
  );
  const instrX = await id(
    db,
    "insert into public.instructors (school_id,name,slug) values ($1,'Lehrer X','lehrer-x') returning id",
    [schoolUnlisted],
  );
  // instrGhost ist mit ghostU verknüpft (schoolA), aber ghostU hat KEINE Schulrolle.
  const instrGhost = await id(
    db,
    "insert into public.instructors (user_id,school_id,name,slug) values ($1,$2,'Geist','geist') returning id",
    [ghostU, schoolA],
  );

  const enrA = await id(
    db,
    "insert into public.enrollments (student_user_id,school_id,status) values ($1,$2,'active') returning id",
    [studentA, schoolA],
  );
  const enrA2 = await id(
    db,
    "insert into public.enrollments (student_user_id,school_id,status) values ($1,$2,'active') returning id",
    [studentA, schoolA],
  );
  const enrB = await id(
    db,
    "insert into public.enrollments (student_user_id,school_id,status) values ($1,$2,'active') returning id",
    [studentB, schoolUnlisted],
  );

  // Termin: fahrlehrerA (über instrA) ist enrA ZUGEWIESEN — enrA2 NICHT.
  const apptA = await id(
    db,
    "insert into public.appointments (enrollment_id,instructor_id,typ) values ($1,$2,'fahrstunde') returning id",
    [enrA, instrA],
  );
  // Termin ohne Instructor auf enrA2 (kein Fahrlehrer sieht ihn; nur Student/Verwaltung).
  const apptUnassigned = await id(
    db,
    "insert into public.appointments (enrollment_id,typ) values ($1,'theorie') returning id",
    [enrA2],
  );
  // Termin auf enrA2 mit instrGhost (ghostU ohne Schulrolle → darf NICHT sehen).
  const apptGhost = await id(
    db,
    "insert into public.appointments (enrollment_id,instructor_id,typ) values ($1,$2,'fahrstunde') returning id",
    [enrA2, instrGhost],
  );

  // veröffentlichte Bewertung für gelistete Schule A
  const reviewA = await id(
    db,
    "insert into public.reviews (school_id,enrollment_id,author_user_id,rating,text,moderation_status,published_at) values ($1,$2,$3,5,'Top','published',now()) returning id",
    [schoolA, enrA, studentA],
  );
  // veröffentlichte Bewertung für NICHT gelistete Schule
  await db.query(
    "insert into public.reviews (school_id,enrollment_id,author_user_id,rating,text,moderation_status,published_at) values ($1,$2,$3,4,'Ok','published',now())",
    [schoolUnlisted, enrB, studentB],
  );

  await db.query(
    "insert into public.blog_posts (title,slug,status,published_at) values ('Pub','pub','published', now() - interval '1 day')",
  );
  await db.query(
    "insert into public.blog_posts (title,slug,status) values ('Draft','draft-x','draft')",
  );
  await db.query(
    "insert into public.blog_posts (title,slug,status,published_at) values ('Future','future','published', now() + interval '10 day')",
  );

  // Rechnungen für DATEV-Trigger
  const invIn = await id(
    db,
    "insert into public.invoices (enrollment_id,betrag,status,erstellt_am) values ($1,100,'paid','2026-01-15') returning id",
    [enrA],
  );
  const invOut = await id(
    db,
    "insert into public.invoices (enrollment_id,betrag,status,erstellt_am) values ($1,50,'paid','2025-12-20') returning id",
    [enrA],
  );
  const invForeign = await id(
    db,
    "insert into public.invoices (enrollment_id,betrag,status,erstellt_am) values ($1,70,'paid','2026-01-10') returning id",
    [enrB],
  );
  const exportA = await id(
    db,
    "insert into public.accounting_exports (school_id,period_start,period_end,format) values ($1,'2026-01-01','2026-01-31','datev_buchungsstapel') returning id",
    [schoolA],
  );

  return {
    studentA, studentB, inhaberA, verwaltungA, fahrlehrerA, ghostU, adminU, supportU, moderatorU, editorU,
    schoolA, schoolUnlisted, instrA, instrX, instrGhost,
    enrA, enrA2, enrB, apptA, apptUnassigned, apptGhost, invIn, invOut, invForeign, exportA,
    reviewA,
  };
}
