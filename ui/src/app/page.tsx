"use client";

import { Section, Cell, Image, List } from "@telegram-apps/telegram-ui";
import { useTranslations } from "next-intl";

import { useRawInitData } from "@tma.js/sdk-react";
import { trpc } from "@/server/client";

export default function Home() {
  // const res = useQuery({
  //   queryKey: ["rawInitData"],
  //   queryFn: () => {
  //     return fetch("/api/routes", {
  //       headers: {
  //         // Authorization: `HELLEIDEJEJEJ`,
  //         ...(rawInitData && { Authorization: rawInitData }),
  //       },
  //     }).then((res) => res.json());
  //   },
  // });
  const res = trpc.test.useQuery();
  return <div>{res.data?.message ?? "no message"}</div>;
}
