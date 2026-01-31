CREATE TYPE "public"."school" AS ENUM('NBS', 'CCDS', 'CCEB', 'EEE', 'CEE', 'MSE', 'MAE', 'ADM', 'SCH', 'SSS', 'WKWSCI', 'LCKM', 'SPMS', 'SBS', 'ASE', 'NIE');--> statement-breakpoint
CREATE TABLE "course_index_request_settled" (
	"id" serial PRIMARY KEY NOT NULL,
	"courseIndexId" integer NOT NULL,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_codes" (
	"code" varchar(255) NOT NULL,
	"userId" integer PRIMARY KEY NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swapper" (
	"telegram_user_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"index" varchar(32) NOT NULL,
	CONSTRAINT "swapper_telegram_user_id_course_id_pk" PRIMARY KEY("telegram_user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "swapper_wants" (
	"telegram_user_id" integer NOT NULL,
	"wantIndex" varchar(32) NOT NULL,
	"course_id" integer NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swapper_wants_telegram_user_id_course_id_wantIndex_pk" PRIMARY KEY("telegram_user_id","course_id","wantIndex")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"userId" integer PRIMARY KEY NOT NULL,
	"handle" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"school" "school",
	"join_date" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "course_index_request_settled" ADD CONSTRAINT "course_index_request_settled_courseIndexId_course_index_id_fk" FOREIGN KEY ("courseIndexId") REFERENCES "public"."course_index"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_userId_users_userId_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swapper" ADD CONSTRAINT "swapper_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swapper_wants" ADD CONSTRAINT "swapper_wants_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swapper_wants" ADD CONSTRAINT "swapper_wants_telegram_user_id_course_id_swapper_telegram_user_id_course_id_fk" FOREIGN KEY ("telegram_user_id","course_id") REFERENCES "public"."swapper"("telegram_user_id","course_id") ON DELETE cascade ON UPDATE no action;