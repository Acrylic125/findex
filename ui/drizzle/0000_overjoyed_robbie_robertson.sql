CREATE TYPE "public"."program_type" AS ENUM('full_time', 'part_time');--> statement-breakpoint
CREATE TABLE "campuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"mazeMapCampusId" integer NOT NULL,
	CONSTRAINT "idx_campuses_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "course_index_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"indexId" integer NOT NULL,
	"timeFromHour" integer NOT NULL,
	"timeFromMinute" integer NOT NULL,
	"timeToHour" integer NOT NULL,
	"timeToMinute" integer NOT NULL,
	"venue" varchar(128) NOT NULL,
	"day" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"remarks" varchar(128) NOT NULL,
	"weeks" integer[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_index_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"indexId" integer NOT NULL,
	"source" integer NOT NULL,
	CONSTRAINT "idx_index_source" UNIQUE("indexId","source")
);
--> statement-breakpoint
CREATE TABLE "course_index" (
	"id" serial PRIMARY KEY NOT NULL,
	"index" varchar(32) NOT NULL,
	"courseId" integer NOT NULL,
	CONSTRAINT "idx_index_course" UNIQUE("index","courseId")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"au" integer NOT NULL,
	"ay" varchar(16) NOT NULL,
	"semester" varchar(16) NOT NULL,
	"search_text" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', "courses"."code"), 'A')
          ||
          setweight(to_tsvector('english', "courses"."name"), 'B')) STORED NOT NULL,
	"isAvailableUE" boolean DEFAULT false NOT NULL,
	"isAvailableBD" boolean DEFAULT false NOT NULL,
	"isAvailableGEPE" boolean DEFAULT false NOT NULL,
	"isSelfPaced" boolean DEFAULT false NOT NULL,
	CONSTRAINT "idx_code_ay_semester" UNIQUE("code","ay","semester")
);
--> statement-breakpoint
CREATE TABLE "location_alt_names" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" integer NOT NULL,
	"altName" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" integer NOT NULL,
	"imageUrl" varchar(256) NOT NULL,
	CONSTRAINT "idx_location_images_locationId_imageUrl" UNIQUE("locationId","imageUrl")
);
--> statement-breakpoint
CREATE TABLE "location_type_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" integer NOT NULL,
	"typeId" integer NOT NULL,
	CONSTRAINT "idx_location_type_locations_locationId_typeId" UNIQUE("locationId","typeId")
);
--> statement-breakpoint
CREATE TABLE "location_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	CONSTRAINT "idx_location_types_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"description" varchar(1024),
	"building" varchar(255),
	"floorName" varchar(64),
	"campusId" integer NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"z" real,
	"mazeMapPoiId" integer NOT NULL,
	"mazeMapIdentifier" varchar(64),
	CONSTRAINT "locations_mazeMapPoiId_unique" UNIQUE("mazeMapPoiId")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"code" varchar(32) NOT NULL,
	"subCode" varchar(32),
	"year" integer,
	"type" "program_type" NOT NULL,
	CONSTRAINT "idx_code_subcode_year" UNIQUE("code","subCode","year")
);
--> statement-breakpoint
ALTER TABLE "course_index_classes" ADD CONSTRAINT "course_index_classes_indexId_course_index_id_fk" FOREIGN KEY ("indexId") REFERENCES "public"."course_index"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_index_sources" ADD CONSTRAINT "course_index_sources_indexId_course_index_id_fk" FOREIGN KEY ("indexId") REFERENCES "public"."course_index"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_index_sources" ADD CONSTRAINT "course_index_sources_source_programs_id_fk" FOREIGN KEY ("source") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_index" ADD CONSTRAINT "course_index_courseId_courses_id_fk" FOREIGN KEY ("courseId") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_alt_names" ADD CONSTRAINT "location_alt_names_locationId_locations_id_fk" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_images" ADD CONSTRAINT "location_images_locationId_locations_id_fk" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_type_locations" ADD CONSTRAINT "location_type_locations_locationId_locations_id_fk" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_type_locations" ADD CONSTRAINT "location_type_locations_typeId_location_types_id_fk" FOREIGN KEY ("typeId") REFERENCES "public"."location_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_campusId_campuses_id_fk" FOREIGN KEY ("campusId") REFERENCES "public"."campuses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_courses_search_text" ON "courses" USING gin ("search_text");--> statement-breakpoint
CREATE INDEX "idx_location_alt_names_altName" ON "location_alt_names" USING btree ("altName");