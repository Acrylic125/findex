import { schools } from "@/lib/types";
import { SQL, sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  serial,
  unique,
  varchar,
  index,
  customType,
  pgEnum,
  boolean,
  real,
  timestamp,
} from "drizzle-orm/pg-core";

/**
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_index_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_index_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_alt_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_type_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE index_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_index_request_settled ENABLE ROW LEVEL SECURITY;
 */

export const tsvector = customType<{
  data: string;
}>({
  dataType() {
    return `tsvector`;
  },
});

// FNTU Tables
export const programType = pgEnum("program_type", ["full_time", "part_time"]);

export const programsTable = pgTable(
  "programs",
  {
    id: serial().notNull().primaryKey(),
    name: varchar({ length: 128 }).notNull(),
    code: varchar({ length: 32 }).notNull(),
    subCode: varchar({ length: 32 }), //.notNull().default(""),
    year: integer(),
    type: programType().notNull(),
  },
  (t) => [unique("idx_code_subcode_year").on(t.code, t.subCode, t.year)]
);

export const coursesTable = pgTable(
  "courses",
  {
    id: serial().notNull().primaryKey(),
    code: varchar({ length: 32 }).notNull(),
    name: varchar({ length: 128 }).notNull(),
    au: integer().notNull(),
    ay: varchar({ length: 16 }).notNull(),
    semester: varchar({ length: 16 }).notNull(),
    searchText: tsvector("search_text")
      .notNull()
      .generatedAlwaysAs(
        (): SQL =>
          sql`setweight(to_tsvector('english', ${coursesTable.code}), 'A')
          ||
          setweight(to_tsvector('english', ${coursesTable.name}), 'B')`
      ),
    //  * Course is available as Unrestricted Elective
    isAvailableUE: boolean().notNull().default(false),
    //  ~ Course is available as Broadening and Deepening Elective
    isAvailableBD: boolean().notNull().default(false),
    //  # Course is available as General Education Prescribed Elective
    isAvailableGEPE: boolean().notNull().default(false),
    //  ^ Self - Paced Course
    isSelfPaced: boolean().notNull().default(false),
  },
  (t) => [
    unique("idx_code_ay_semester").on(t.code, t.ay, t.semester),
    index("idx_courses_search_text").using("gin", t.searchText),
  ]
);

export const courseIndexTable = pgTable(
  "course_index",
  {
    id: serial().notNull().primaryKey(),
    index: varchar({ length: 32 }).notNull(),
    courseId: integer()
      .notNull()
      .references(() => coursesTable.id, { onDelete: "cascade" }),
  },
  (t) => [unique("idx_index_course").on(t.index, t.courseId)]
);

export const courseIndexSourcesTable = pgTable(
  "course_index_sources",
  {
    id: serial().notNull().primaryKey(),
    indexId: integer()
      .notNull()
      .references(() => courseIndexTable.id, { onDelete: "cascade" }),
    source: integer()
      .notNull()
      .references(() => programsTable.id, { onDelete: "cascade" }),
  },
  (t) => [unique("idx_index_source").on(t.indexId, t.source)]
);

export const courseIndexClassesTable = pgTable("course_index_classes", {
  id: serial().notNull().primaryKey(),
  indexId: integer()
    .notNull()
    .references(() => courseIndexTable.id, { onDelete: "cascade" }),
  timeFromHour: integer().notNull(),
  timeFromMinute: integer().notNull(),
  timeToHour: integer().notNull(),
  timeToMinute: integer().notNull(),
  venue: varchar({ length: 128 }).notNull(),
  day: integer().notNull(),
  type: varchar({ length: 32 }).notNull(),
  remarks: varchar({ length: 128 }).notNull(),
  weeks: integer().array().notNull(),
});

export const locationsTable = pgTable("locations", {
  id: serial().notNull().primaryKey(),
  name: varchar({ length: 255 }),
  description: varchar({ length: 1024 }),
  building: varchar({ length: 255 }),
  floorName: varchar({ length: 64 }),
  campusId: integer()
    .notNull()
    .references(() => campusTable.id, { onDelete: "cascade" }),
  latitude: real().notNull(),
  longitude: real().notNull(),
  z: real(),
  mazeMapPoiId: integer().unique().notNull(),
  mazeMapIdentifier: varchar({ length: 64 }),
});

export const campusTable = pgTable(
  "campuses",
  {
    id: serial().notNull().primaryKey(),
    name: varchar({ length: 32 }).notNull(),
    mazeMapCampusId: integer().notNull(),
  },
  (t) => [unique("idx_campuses_name").on(t.name)]
);

export const locationTypesTable = pgTable(
  "location_types",
  {
    id: serial().notNull().primaryKey(),
    name: varchar({ length: 32 }).notNull(),
  },
  (t) => [unique("idx_location_types_name").on(t.name)]
);

export const locationTypeLocationsTable = pgTable(
  "location_type_locations",
  {
    id: serial().notNull().primaryKey(),
    locationId: integer()
      .notNull()
      .references(() => locationsTable.id, { onDelete: "cascade" }),
    typeId: integer()
      .notNull()
      .references(() => locationTypesTable.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("idx_location_type_locations_locationId_typeId").on(
      t.locationId,
      t.typeId
    ),
  ]
);

export const locationImagesTable = pgTable(
  "location_images",
  {
    id: serial().notNull().primaryKey(),
    locationId: integer()
      .notNull()
      .references(() => locationsTable.id, { onDelete: "cascade" }),
    imageUrl: varchar({ length: 256 }).notNull(),
  },
  (t) => [
    unique("idx_location_images_locationId_imageUrl").on(
      t.locationId,
      t.imageUrl
    ),
  ]
);

// Alt names for locations. We have tried using an array of varchar(255) but it was too slow.
export const locationAltNamesTable = pgTable(
  "location_alt_names",
  {
    id: serial().notNull().primaryKey(),
    locationId: integer()
      .notNull()
      .references(() => locationsTable.id, { onDelete: "cascade" }),
    altName: varchar({ length: 255 }).notNull(),
  },
  (t) => [index("idx_location_alt_names_altName").on(t.altName)]
);

// FIndex Specific Tables
export const schoolEnum = pgEnum("school", schools);

export const usersTable = pgTable("users", {
  userId: integer().notNull().primaryKey(),
  handle: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
  school: schoolEnum(),
  joinDate: timestamp("join_date").notNull().defaultNow(),
  verifiedAt: timestamp("verified_at"),
});

export const emailVerificationCodesTable = pgTable("email_verification_codes", {
  code: varchar({ length: 255 }).notNull(),
  userId: integer()
    .primaryKey()
    .references(() => usersTable.userId, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const indexRequestsTable = pgTable(
  "index_requests",
  {
    telegramUserId: integer().notNull(),
    courseIndexId: integer()
      .notNull()
      .references(() => courseIndexTable.id, { onDelete: "cascade" }),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
  },
  (t) => [
    unique("idx_index_requests_courseIndexId_telegramUserId").on(
      t.courseIndexId,
      t.telegramUserId
    ),
  ]
);

export const courseIndexRequestSettledTable = pgTable(
  "course_index_request_settled",
  {
    id: serial().notNull().primaryKey(),
    courseIndexId: integer()
      .notNull()
      .references(() => courseIndexTable.id, { onDelete: "cascade" }),
    settledAt: timestamp("settled_at").notNull().defaultNow(),
  }
);
