"use client";

import Link from "next/link";
import { useI18n } from "@/lib/use-i18n";
import { selectActiveGameProgress, useGameStore } from "@/store/gameStore";

const courses = [
  {
    id: "nce-1997",
    href: "/books",
    titleEn: "New Concept English",
    titleZh: "新概念英语",
    total: 400
  },
  {
    id: "ielts-nawl-v1",
    href: "/courses/ielts-nawl-v1",
    titleEn: "IELTS Vocabulary",
    titleZh: "IELTS 备考词汇",
    total: 200
  },
  {
    id: "kaoyan-core-v1",
    href: "/courses/kaoyan-core-v1",
    titleEn: "Kaoyan Vocabulary",
    titleZh: "考研核心词汇·起步篇",
    total: 200
  }
] as const;

export function CourseCatalog() {
  const { language, t } = useI18n();
  const levels = useGameStore(selectActiveGameProgress).levels;
  return (
    <section className="rounded-lg border-2 border-ink bg-white p-4">
      <h2 className="text-xl font-black text-ink">{t("courses.title")}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {courses.map((course) => {
          const done = Object.entries(levels).filter(
            ([id, value]) => id.startsWith(`${course.id}-`) && value.completed
          ).length;
          const title = language === "zh-CN" ? course.titleZh : course.titleEn;
          return (
            <Link key={course.id} href={course.href} className="focus-ring rounded-lg border-2 border-ink bg-paper p-4">
              <span className="block text-xs font-black opacity-70">{done}/{course.total}</span>
              <strong className="mt-3 block text-lg">{title}</strong>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
